import { applySet } from "../action/applySet"
import { getCurrentActionContext } from "../action/context"
import { modelAction } from "../action/modelAction"
import { AnyDataModel, BaseDataModel, baseDataModelPropNames } from "../dataModel/BaseDataModel"
import type { DataModelConstructorOptions } from "../dataModel/DataModelConstructorOptions"
import type { DataModelMetadata } from "../dataModel/getDataModelMetadata"
import { getGlobalConfig } from "../globalConfig/globalConfig"
import { AnyModel, BaseModel, baseModelPropNames } from "../model/BaseModel"
import type { ModelMetadata } from "../model/getModelMetadata"
import { modelTypeKey } from "../model/metadata"
import type { ModelConstructorOptions } from "../model/ModelConstructorOptions"
import { typesObject } from "../typeChecking/object"
import { typesString } from "../typeChecking/primitives"
import type { AnyType } from "../typeChecking/schemas"
import { tProp } from "../typeChecking/tProp"
import type { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { assertIsObject, failure, propNameToSetterName } from "../utils"
import { ModelClass, modelInitializedSymbol, ModelTransformedData } from "./BaseModelShared"
import { modelInitializersSymbol } from "./modelClassInitializer"
import { getInternalModelClassPropsInfo, setInternalModelClassPropsInfo } from "./modelPropsInfo"
import { modelMetadataSymbol, modelUnwrappedClassSymbol } from "./modelSymbols"
import { AnyModelProp, ModelProps, prop } from "./prop"
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

function getModelInstanceDataField<M extends AnyModel | AnyDataModel>(
  model: M,
  modelProp: AnyModelProp | undefined,
  modelPropName: keyof ModelTransformedData<M>
): ModelTransformedData<M>[typeof modelPropName] {
  // no need to use get since these vars always get on the initial $
  const value = model.$[modelPropName]

  if (modelProp?.transform) {
    return modelProp.transform.transform(value, model, modelPropName, (newValue) => {
      // use apply set instead to wrap it in an action
      // set the $ object to set the original value directly
      applySet(model.$, modelPropName, newValue)
    })
  }

  return value
}

function setModelInstanceDataField<M extends AnyModel | AnyDataModel>(
  model: M,
  modelProp: AnyModelProp | undefined,
  modelPropName: keyof ModelTransformedData<M>,
  value: ModelTransformedData<M>[typeof modelPropName]
): void {
  if (modelProp?.setter === "assign" && !getCurrentActionContext()) {
    // use apply set instead to wrap it in an action
    applySet(model, modelPropName, value)
    return
  }

  const transformedValue = modelProp?.transform
    ? modelProp.transform.untransform(value, model, modelPropName)
    : value
  // no need to use set since these vars always get on the initial $
  model.$[modelPropName] = transformedValue
}

const idGenerator = () => getGlobalConfig().modelIdGenerator()
const tPropForId = tProp(typesString, idGenerator)
tPropForId.isId = true
const propForId = prop(idGenerator)
propForId.isId = true

export function sharedInternalModel<
  TProps extends ModelProps,
  TBaseModel extends AnyModel | AnyDataModel
>({
  modelProps,
  baseModel,
  type,
  valueType,
  fromSnapshotProcessor,
  toSnapshotProcessor,
}: {
  modelProps: TProps
  baseModel: ModelClass<TBaseModel> | undefined
  type: "class" | "data"
  valueType: boolean
  fromSnapshotProcessor: ((sn: any) => any) | undefined
  toSnapshotProcessor: ((sn: any, instance: any) => any) | undefined
}): any {
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
  const idKeys = Object.keys(composedModelProps).filter((k) => {
    const p = composedModelProps[k]
    return p.isId
  })
  if (type === "class") {
    if (idKeys.length > 1) {
      throw failure(`expected at most one idProp but got many: ${JSON.stringify(idKeys)}`)
    }
  } else {
    if (idKeys.length >= 1) {
      throw failure(`expected no idProp but got some: ${JSON.stringify(idKeys)}`)
    }
  }

  const needsTypeChecker = Object.values(composedModelProps).some((mp) => !!mp.typeChecker)

  // transform id keys (only one really)
  let idKey: string | undefined
  if (idKeys.length >= 1) {
    idKey = idKeys[0]
    const idProp = composedModelProps[idKey]
    let baseProp: AnyModelProp = needsTypeChecker ? tPropForId : propForId
    switch (idProp?.setter) {
      case true:
        baseProp = baseProp.withSetter()
        break
      case "assign":
        baseProp = baseProp.withSetter("assign")
        break
      default:
        break
    }
    composedModelProps[idKey] = baseProp
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
    const metadata: ModelMetadata = {
      dataType: dataTypeChecker as unknown as AnyType | undefined,
      modelIdProperty: idKey,
      valueType,
    }
    CustomBaseModel[modelMetadataSymbol] = metadata
  } else {
    const metadata: DataModelMetadata = {
      dataType: dataTypeChecker as unknown as AnyType | undefined,
    }
    CustomBaseModel[modelMetadataSymbol] = metadata
  }

  Object.defineProperties(CustomBaseModel.prototype, extraDescriptors)

  // add setter actions to prototype
  for (const [propName, propData] of Object.entries(modelProps)) {
    if (propData.setter === true) {
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

  if (fromSnapshotProcessor) {
    const fn = fromSnapshotProcessor
    fromSnapshotProcessor = (sn) => ({ ...fn(sn), [modelTypeKey]: sn[modelTypeKey] })
  }

  if (toSnapshotProcessor) {
    const fn = toSnapshotProcessor
    toSnapshotProcessor = (sn: any, instance: any) => ({
      ...fn(sn, instance),
      [modelTypeKey]: sn[modelTypeKey],
    })
  }

  CustomBaseModel.fromSnapshotProcessor = fromSnapshotProcessor
  CustomBaseModel.toSnapshotProcessor = toSnapshotProcessor

  return CustomBaseModel
}
