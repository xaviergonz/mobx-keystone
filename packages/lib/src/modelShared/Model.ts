import { applySet } from "../action/applySet"
import { getCurrentActionContext } from "../action/context"
import { modelAction } from "../action/modelAction"
import { AnyDataModel, BaseDataModel, baseDataModelPropNames } from "../dataModel/BaseDataModel"
import type { DataModelConstructorOptions } from "../dataModel/DataModelConstructorOptions"
import type { DataModelMetadata } from "../dataModel/getDataModelMetadata"
import { isDataModel } from "../dataModel/utils"
import { getGlobalConfig } from "../globalConfig/globalConfig"
import { AnyModel, BaseModel, baseModelPropNames } from "../model/BaseModel"
import type { ModelMetadata } from "../model/getModelMetadata"
import { modelIdKey } from "../model/metadata"
import type { ModelConstructorOptions } from "../model/ModelConstructorOptions"
import { memoTransformCache } from "../propTransform/propTransform"
import { typesObject } from "../typeChecking/object"
import { typesString } from "../typeChecking/primitives"
import { tProp } from "../typeChecking/tProp"
import type { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { assertIsObject, failure, propNameToSetterName } from "../utils"
import { ModelClass, modelInitializedSymbol, ModelInstanceData } from "./BaseModelShared"
import { modelInitializersSymbol } from "./modelClassInitializer"
import { getInternalModelClassPropsInfo, setInternalModelClassPropsInfo } from "./modelPropsInfo"
import { modelMetadataSymbol, modelUnwrappedClassSymbol } from "./modelSymbols"
import { AnyModelProp, idProp, ModelProps, noDefaultValue, prop } from "./prop"
import { assertIsClassOrDataModelClass } from "./utils"

function __extends(subClass: any, superClass: any) {
  Object.setPrototypeOf(subClass, superClass)
  function __(this: any) {
    this.constructor = subClass
  }
  __.prototype = superClass.prototype
  subClass.prototype = new (__ as any)()
}

export function createModelPropDescriptor(
  modelPropName: string,
  modelProp: AnyModelProp | undefined,
  enumerable: boolean
): PropertyDescriptor {
  return {
    enumerable,
    configurable: true,
    get(this: AnyModel | AnyDataModel) {
      return getModelInstanceDataField(this, modelProp, modelPropName)
    },
    set(this: AnyModel | AnyDataModel, v?: any) {
      // hack to only permit setting these values once fully constructed
      // this is to ignore abstract properties being set by babel
      // see https://github.com/xaviergonz/mobx-keystone/issues/18
      if (!(this as any)[modelInitializedSymbol]) {
        return
      }
      setModelInstanceDataField(this, modelProp, modelPropName, v)
    },
  }
}

export function getModelInstanceDataField<M extends AnyModel | AnyDataModel>(
  model: M,
  modelProp: AnyModelProp | undefined,
  modelPropName: keyof ModelInstanceData<M>
): ModelInstanceData<M>[typeof modelPropName] {
  const transform = modelProp ? modelProp.transform : undefined

  if (transform) {
    // no need to use get since these vars always get on the initial $
    const memoTransform = memoTransformCache.getOrCreateMemoTransform(
      model,
      modelPropName as string,
      transform
    )
    return memoTransform.propToData(model.$[modelPropName])
  } else {
    // no need to use get since these vars always get on the initial $
    return model.$[modelPropName]
  }
}

export function setModelInstanceDataField<M extends AnyModel | AnyDataModel>(
  model: M,
  modelProp: AnyModelProp | undefined,
  modelPropName: keyof ModelInstanceData<M>,
  value: ModelInstanceData<M>[typeof modelPropName]
): void {
  if (modelProp?.options.setter === "assign" && !getCurrentActionContext()) {
    // use apply set instead to wrap it in an action
    if (isDataModel(model)) {
      applySet(model.$, modelPropName as any, value)
    } else {
      applySet(model, modelPropName as any, value)
    }
    return
  }

  const transform = modelProp?.transform

  if (transform) {
    // no need to use set since these vars always get on the initial $
    const memoTransform = memoTransformCache.getOrCreateMemoTransform(
      model,
      modelPropName as string,
      transform
    )
    model.$[modelPropName] = memoTransform.dataToProp(value)
  } else {
    // no need to use set since these vars always get on the initial $
    model.$[modelPropName] = value
  }
}

export function sharedInternalModel<
  TProps extends ModelProps,
  TBaseModel extends AnyModel | AnyDataModel
>(modelProps: TProps, baseModel: ModelClass<TBaseModel> | undefined, type: "class" | "data"): any {
  assertIsObject(modelProps, "modelProps")
  if (baseModel) {
    assertIsClassOrDataModelClass(baseModel, "baseModel")

    // if the baseModel is wrapped with the model decorator get the original one
    const unwrappedClass = (baseModel as any)[modelUnwrappedClassSymbol]
    if (unwrappedClass) {
      baseModel = unwrappedClass
      assertIsClassOrDataModelClass(baseModel, "baseModel")
    }
  }

  const extraDescriptors: PropertyDescriptorMap = {}

  const composedModelProps: ModelProps = modelProps
  if (baseModel) {
    const oldModelProps = getInternalModelClassPropsInfo(baseModel)
    for (const oldModelPropKey of Object.keys(oldModelProps)) {
      if (modelProps[oldModelPropKey]) {
        throw failure(
          `extended model cannot redeclare base model property named '${oldModelPropKey}'`
        )
      }
      composedModelProps[oldModelPropKey] = oldModelProps[oldModelPropKey]
    }
  }

  // look for id keys
  const idKeys = Object.keys(composedModelProps).filter((k) => composedModelProps[k] === idProp)
  if (type === "class") {
    if (idKeys.length > 1) {
      throw failure(`expected at most one idProp but got many: ${JSON.stringify(idKeys)}`)
    }
    if (idKeys.length <= 0) {
      idKeys.push(modelIdKey)
    }
  } else {
    if (idKeys.length >= 1) {
      throw failure(`expected no idProp but got some: ${JSON.stringify(idKeys)}`)
    }
  }

  if (type === "data") {
    // make sure props have no defaults
    for (const [k, mp] of Object.entries(composedModelProps)) {
      if (mp.defaultValue !== noDefaultValue || mp.defaultFn !== noDefaultValue) {
        throw failure(
          `data models do not support properties with default values, but property '${k}' has one`
        )
      }
    }
  }

  const needsTypeChecker = Object.values(composedModelProps).some((mp) => !!mp.typeChecker)

  // transform id keys (only one really)
  let idKey
  if (idKeys.length >= 1) {
    idKey = idKeys[0]
    const idGenerator = () => getGlobalConfig().modelIdGenerator()
    composedModelProps[idKey] = needsTypeChecker
      ? tProp(typesString, idGenerator)
      : prop(idGenerator)
  }

  // create type checker if needed
  let dataTypeChecker: LateTypeChecker | undefined
  if (needsTypeChecker) {
    const typeCheckerObj: {
      [k: string]: any
    } = {}
    for (const [k, mp] of Object.entries(composedModelProps)) {
      typeCheckerObj[k] = !mp.typeChecker ? typesUnchecked() : mp.typeChecker
    }
    dataTypeChecker = typesObject(() => typeCheckerObj) as any
  }

  const basePropNames = type === "class" ? baseModelPropNames : baseDataModelPropNames

  // skip props that are on base model, these have to be accessed through $
  // we only need to proxy new props, not old ones
  for (const modelPropName of Object.keys(modelProps).filter(
    (mp) => !basePropNames.has(mp as any)
  )) {
    extraDescriptors[modelPropName] = createModelPropDescriptor(
      modelPropName,
      modelProps[modelPropName],
      false
    )
  }

  const extraPropNames = Object.keys(extraDescriptors)
  const extraPropNamesLen = extraPropNames.length

  const base: any = baseModel ?? (type === "class" ? BaseModel : BaseDataModel)

  const propsWithTransforms = Object.entries(modelProps)
    .filter(([_propName, prop]) => !!prop.transform)
    .map(([propName, prop]) => [propName, prop.transform!] as const)

  // we use this weird hack rather than just class CustomBaseModel extends base {}
  // in order to work around problems with ES5 classes extending ES6 classes
  // see https://github.com/xaviergonz/mobx-keystone/issues/15
  const CustomBaseModel: any = (function (_base) {
    __extends(CustomBaseModel, _base)

    function CustomBaseModel(
      this: any,
      initialData: any,
      constructorOptions?: ModelConstructorOptions | DataModelConstructorOptions
    ) {
      const modelClass = constructorOptions?.modelClass ?? this.constructor
      const baseModel = new _base(initialData, {
        ...constructorOptions,
        modelClass,
        propsWithTransforms,
      } as ModelConstructorOptions & DataModelConstructorOptions)

      // make sure abstract classes do not override prototype props
      for (let i = 0; i < extraPropNamesLen; i++) {
        const extraPropName = extraPropNames[i]
        if (Object.getOwnPropertyDescriptor(baseModel, extraPropName)) {
          delete baseModel[extraPropName]
        }
      }

      return baseModel
    }

    return CustomBaseModel
  })(base)

  const initializers = base[modelInitializersSymbol]
  if (initializers) {
    CustomBaseModel[modelInitializersSymbol] = initializers.slice()
  }

  setInternalModelClassPropsInfo(CustomBaseModel, composedModelProps)

  if (type === "class") {
    CustomBaseModel[modelMetadataSymbol] = {
      dataType: dataTypeChecker,
      modelIdProperty: idKey,
    } as ModelMetadata
  } else {
    CustomBaseModel[modelMetadataSymbol] = {
      dataType: dataTypeChecker,
    } as DataModelMetadata
  }

  Object.defineProperties(CustomBaseModel.prototype, extraDescriptors)

  // add setter actions to prototype
  for (const [propName, propData] of Object.entries(modelProps)) {
    if (propData.options.setter) {
      const setterName = propNameToSetterName(propName)

      CustomBaseModel.prototype[setterName] = function (this: any, value: any) {
        this[propName] = value
      }

      const newPropDescriptor: any = modelAction(
        CustomBaseModel.prototype,
        setterName,
        Object.getOwnPropertyDescriptor(CustomBaseModel.prototype, setterName)
      )

      Object.defineProperty(CustomBaseModel.prototype, setterName, newPropDescriptor)
    }
  }

  return CustomBaseModel
}
