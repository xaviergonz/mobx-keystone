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
import { typesObject } from "../types/objectBased/typesObject"
import { typesString } from "../types/primitiveBased/typesPrimitive"
import type { AnyType } from "../types/schemas"
import { tProp } from "../types/tProp"
import type { LateTypeChecker } from "../types/TypeChecker"
import { typesUnchecked } from "../types/utility/typesUnchecked"
import { assertIsObject, failure, propNameToSetterName } from "../utils"
import { chainFns } from "../utils/chainFns"
import { ModelClass, modelInitializedSymbol } from "./BaseModelShared"
import { modelInitializersSymbol } from "./modelClassInitializer"
import { getInternalModelClassPropsInfo, setInternalModelClassPropsInfo } from "./modelPropsInfo"
import { modelMetadataSymbol, modelUnwrappedClassSymbol } from "./modelSymbols"
import { AnyModelProp, getModelPropDefaultValue, ModelProps, noDefaultValue, prop } from "./prop"
import { assertIsClassOrDataModelClass } from "./utils"

function getModelInstanceDataField<M extends AnyModel | AnyDataModel>(
  model: M,
  modelProp: AnyModelProp | undefined,
  modelPropName: string
): any {
  // no need to use get since these vars always get on the initial $
  const value = model.$[modelPropName]

  if (modelProp?._transform) {
    return modelProp._transform.transform(value, model, modelPropName, (newValue) => {
      // use apply set instead to wrap it in an action
      // set the $ object to set the original value directly
      applySet(model.$, modelPropName, newValue)
    }) as any
  }

  return value
}

function setModelInstanceDataField<M extends AnyModel | AnyDataModel>(
  model: M,
  modelProp: AnyModelProp | undefined,
  modelPropName: string,
  value: any
): void {
  // hack to only permit setting these values once fully constructed
  // this is to ignore abstract properties being set by babel
  // see https://github.com/xaviergonz/mobx-keystone/issues/18
  if (!(modelInitializedSymbol in model)) {
    return
  }

  if (modelProp?._setter === "assign" && !getCurrentActionContext()) {
    // use apply set instead to wrap it in an action
    applySet(model, modelPropName as any, value)
    return
  }

  let untransformedValue = modelProp?._transform
    ? modelProp._transform.untransform(value, model, modelPropName)
    : value

  // apply default value if applicable
  if (modelProp && untransformedValue == null) {
    const defaultValue = getModelPropDefaultValue(modelProp)
    if (defaultValue !== noDefaultValue) {
      untransformedValue = defaultValue
    }
  }

  // no need to use set since these vars always get on the initial $
  model.$[modelPropName] = untransformedValue
}

const idGenerator = () => getGlobalConfig().modelIdGenerator()
const tPropForId = tProp(typesString, idGenerator)
tPropForId._isId = true
const propForId = prop(idGenerator)
propForId._isId = true

type FromSnapshotProcessorFn = (sn: any) => any
type ToSnapshotProcessorFn = (sn: any, instance: any) => any

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
  fromSnapshotProcessor: FromSnapshotProcessorFn | undefined
  toSnapshotProcessor: ToSnapshotProcessorFn | undefined
}): any {
  assertIsObject(modelProps, "modelProps")

  // make sure we avoid prototype pollution
  modelProps = Object.assign(Object.create(null), modelProps)

  if (baseModel) {
    assertIsClassOrDataModelClass(baseModel, "baseModel")

    // if the baseModel is wrapped with the model decorator get the original one
    const unwrappedClass = (baseModel as any)[modelUnwrappedClassSymbol]
    if (unwrappedClass) {
      baseModel = unwrappedClass
      assertIsClassOrDataModelClass(baseModel, "baseModel")
    }
  }

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
    return p._isId
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

  const needsTypeChecker = Object.values(composedModelProps).some((mp) => !!mp._typeChecker)

  // transform id keys (only one really)
  let idKey: string | undefined
  if (idKeys.length >= 1) {
    idKey = idKeys[0]
    const idProp = composedModelProps[idKey]
    let baseProp: AnyModelProp = needsTypeChecker ? tPropForId : propForId
    switch (idProp?._setter) {
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
      typeCheckerObj[k] = !mp._typeChecker ? typesUnchecked() : mp._typeChecker
    }
    dataTypeChecker = typesObject(() => typeCheckerObj) as any
  }

  const base: any = baseModel ?? (type === "class" ? BaseModel : BaseDataModel)
  const basePropNames = type === "class" ? baseModelPropNames : baseDataModelPropNames

  let propsToDeleteFromBase: string[] | undefined

  // we use this weird hack rather than just class CustomBaseModel extends base {}
  // in order to work around problems with ES5 classes extending ES6 classes
  // see https://github.com/xaviergonz/mobx-keystone/issues/15
  function ThisModel(
    this: any,
    initialData: any,
    constructorOptions?: ModelConstructorOptions | DataModelConstructorOptions
  ) {
    const modelClass = constructorOptions?.modelClass ?? this.constructor
    const baseModel = new base(initialData, {
      ...constructorOptions,
      modelClass,
    } as ModelConstructorOptions & DataModelConstructorOptions)

    // make sure abstract classes do not override prototype props
    if (!propsToDeleteFromBase) {
      propsToDeleteFromBase = Object.keys(composedModelProps).filter(
        (p) => !basePropNames.has(p as any) && Object.hasOwn(baseModel, p)
      )
    }

    propsToDeleteFromBase.forEach((prop) => delete baseModel[prop])

    return baseModel
  }

  // copy static props from base
  Object.assign(ThisModel, base)

  const initializers = base[modelInitializersSymbol]
  if (initializers) {
    ThisModel[modelInitializersSymbol] = initializers.slice()
  }

  setInternalModelClassPropsInfo(ThisModel as any, composedModelProps)

  if (type === "class") {
    const metadata: ModelMetadata = {
      dataType: dataTypeChecker as unknown as AnyType | undefined,
      modelIdProperty: idKey,
      valueType,
    }
    ThisModel[modelMetadataSymbol] = metadata
  } else {
    const metadata: DataModelMetadata = {
      dataType: dataTypeChecker as unknown as AnyType | undefined,
    }
    ThisModel[modelMetadataSymbol] = metadata
  }

  const newPrototype = Object.create(base.prototype)

  ThisModel.prototype = new Proxy(newPrototype, {
    get(target, p, receiver) {
      if (receiver === ThisModel.prototype) {
        return target[p]
      }

      const modelProp = !basePropNames.has(p as any) && composedModelProps[p as string]
      return modelProp
        ? getModelInstanceDataField(receiver, modelProp, p as string)
        : Reflect.get(target, p, receiver)
    },

    set(target, p, v, receiver) {
      if (receiver === ThisModel.prototype) {
        target[p] = v
        return true
      }

      const modelProp = !basePropNames.has(p as any) && composedModelProps[p as string]
      if (modelProp) {
        setModelInstanceDataField(receiver, modelProp, p as string, v)
        return true
      }
      return Reflect.set(target, p, v, receiver)
    },

    has(target, p) {
      const modelProp = !basePropNames.has(p as any) && composedModelProps[p as string]
      return !!modelProp || Reflect.has(target, p)
    },
  })

  newPrototype.constructor = ThisModel

  // add setter actions to prototype
  for (const [propName, propData] of Object.entries(modelProps)) {
    if (propData._setter === true) {
      const setterName = propNameToSetterName(propName)

      const newPropDescriptor: any = modelAction(newPrototype, setterName, {
        value: function (this: any, value: any) {
          this[propName] = value
        },
        writable: true,
        enumerable: false,
        configurable: true,
      })

      // we use define property to avoid the base proxy
      Object.defineProperty(newPrototype, setterName, newPropDescriptor)
    }
  }

  const modelPropsFromSnapshotProcessor = getModelPropsFromSnapshotProcessor(composedModelProps)

  const modelPropsToSnapshotProcessor = getModelPropsToSnapshotProcessor(composedModelProps)

  if (fromSnapshotProcessor) {
    const fn = fromSnapshotProcessor
    fromSnapshotProcessor = (sn) => {
      return {
        ...fn(sn),
        [modelTypeKey]: sn[modelTypeKey],
      }
    }
  }

  if (toSnapshotProcessor) {
    const fn = toSnapshotProcessor
    toSnapshotProcessor = (sn, modelInstance) => {
      return {
        ...fn(sn, modelInstance),
        [modelTypeKey]: sn[modelTypeKey],
      }
    }
  }

  ThisModel.fromSnapshotProcessor = chainFns(fromSnapshotProcessor, modelPropsFromSnapshotProcessor)
  ThisModel.toSnapshotProcessor = chainFns(modelPropsToSnapshotProcessor, toSnapshotProcessor)

  return ThisModel
}

function getModelPropsFromSnapshotProcessor(
  composedModelProps: ModelProps
): FromSnapshotProcessorFn | undefined {
  const propsWithFromSnapshotProcessor = Object.entries(composedModelProps).filter(
    ([_propName, propData]) => propData._fromSnapshotProcessor
  )
  if (propsWithFromSnapshotProcessor.length <= 0) {
    return undefined
  }

  return (sn) => {
    const newSn = { ...sn }
    for (const [propName, propData] of propsWithFromSnapshotProcessor) {
      if (propData._fromSnapshotProcessor) {
        newSn[propName] = propData._fromSnapshotProcessor(sn[propName])
      }
    }
    return newSn
  }
}

function getModelPropsToSnapshotProcessor(
  composedModelProps: ModelProps
): ToSnapshotProcessorFn | undefined {
  const propsWithToSnapshotProcessor = Object.entries(composedModelProps).filter(
    ([_propName, propData]) => propData._toSnapshotProcessor
  )

  if (propsWithToSnapshotProcessor.length <= 0) {
    return undefined
  }

  return (sn) => {
    const newSn = { ...sn }
    for (const [propName, propData] of propsWithToSnapshotProcessor) {
      if (propData._toSnapshotProcessor) {
        newSn[propName] = propData._toSnapshotProcessor(sn[propName])
      }
    }
    return newSn
  }
}
