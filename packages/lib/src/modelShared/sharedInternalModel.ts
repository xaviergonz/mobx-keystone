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
import { withErrorPathSegment } from "../utils/errorDiagnostics"
import { addHiddenProp, assertIsObject, failure, propNameToSetterName } from "../utils"
import { chainFns } from "../utils/chainFns"
import { ModelClass, modelInitializedSymbol } from "./BaseModelShared"
import { ModelClassInitializer, modelInitializersSymbol } from "./modelClassInitializer"
import { getInternalModelClassPropsInfo, setInternalModelClassPropsInfo } from "./modelPropsInfo"
import { modelMetadataSymbol, modelUnwrappedClassSymbol } from "./modelSymbols"
import { AnyModelProp, getModelPropDefaultValue, ModelProps, noDefaultValue, prop } from "./prop"
import { assertIsClassOrDataModelClass } from "./utils"

function createGetModelInstanceDataField<M extends AnyModel | AnyDataModel>(
  modelProp: AnyModelProp,
  modelPropName: string
): (this: M) => unknown {
  const transformFn = modelProp._transform?.transform

  if (!transformFn) {
    // no need to use get since these vars always get on the initial $
    return function (this) {
      return this.$[modelPropName]
    }
  }

  const transformValue = (model: M, value: unknown) =>
    transformFn(value, model, modelPropName, (newValue) => {
      // use apply set instead to wrap it in an action
      // set the $ object to set the original value directly
      applySet(model.$, modelPropName, newValue)
    })

  return function (this) {
    // no need to use get since these vars always get on the initial $
    const value = this.$[modelPropName]
    return transformValue(this, value)
  }
}

type SetModelInstanceDataFieldFn = <M extends AnyModel | AnyDataModel>(
  modelProp: AnyModelProp,
  modelPropName: string,
  model: M,
  value: unknown
) => boolean | void

const setModelInstanceDataField: SetModelInstanceDataFieldFn = (
  modelProp,
  modelPropName,
  model,
  value
): void => {
  if (modelProp._setter === "assign" && !getCurrentActionContext()) {
    // use apply set instead to wrap it in an action
    applySet(model, modelPropName as any, value)
    return
  }

  if (modelProp._setterValueTransform) {
    value = modelProp._setterValueTransform(value)
  }

  let untransformedValue = modelProp._transform
    ? withErrorPathSegment(modelPropName, () =>
        modelProp._transform!.untransform(value, model, modelPropName)
      )
    : value

  // apply default value if applicable
  if (untransformedValue == null) {
    const defaultValue = getModelPropDefaultValue(modelProp)
    if (defaultValue !== noDefaultValue) {
      untransformedValue = defaultValue
    }
  }

  // no need to use set since these vars always get on the initial $
  model.$[modelPropName] = untransformedValue
}

const setModelInstanceDataFieldWithPrecheck: SetModelInstanceDataFieldFn = (
  modelProp,
  modelPropName,
  model,
  value
): boolean => {
  // hack to only permit setting these values once fully constructed
  // this is to ignore abstract properties being set by babel
  // see https://github.com/xaviergonz/mobx-keystone/issues/18
  if (!(model as any)[modelInitializedSymbol]) {
    return false
  }
  setModelInstanceDataField(modelProp, modelPropName, model, value)
  return true
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
  TBaseModel extends AnyModel | AnyDataModel,
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
      if (!modelProps[oldModelPropKey]) {
        composedModelProps[oldModelPropKey] = oldModelProps[oldModelPropKey]
      }
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
  } else if (idKeys.length > 0) {
    throw failure(`expected no idProp but got some: ${JSON.stringify(idKeys)}`)
  }

  const needsTypeChecker = Object.values(composedModelProps).some((mp) => !!mp._typeChecker)

  // transform id keys (only one really)
  let idKey: string | undefined
  if (idKeys.length > 0) {
    idKey = idKeys[0]
    const idProp = composedModelProps[idKey]
    let baseProp: AnyModelProp = needsTypeChecker ? tPropForId : propForId
    switch (idProp._setter) {
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
      typeCheckerObj[k] = mp._typeChecker ? mp._typeChecker : typesUnchecked()
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

    // add prop, it is faster than having to go to the root of the prototype to not find it
    addHiddenProp(baseModel, modelInitializedSymbol, false, true)

    // make sure abstract classes do not override prototype props
    if (!propsToDeleteFromBase) {
      propsToDeleteFromBase = Object.keys(modelProps).filter(
        (p) => !basePropNames.has(p as any) && Object.hasOwn(baseModel, p)
      )
    }

    propsToDeleteFromBase.forEach((prop) => {
      delete baseModel[prop]
    })

    return baseModel
  }

  // copy static props from base
  Object.assign(ThisModel, base)

  const initializers: ModelClassInitializer[] = base[modelInitializersSymbol]
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

  ThisModel.prototype = Object.create(base.prototype)
  ThisModel.prototype.constructor = ThisModel

  let setFn: SetModelInstanceDataFieldFn = (modelProp, modelPropName, model, value) => {
    if (setModelInstanceDataFieldWithPrecheck(modelProp, modelPropName, model, value)) {
      setFn = setModelInstanceDataField
    }
  }

  for (const [propName, propData] of Object.entries(modelProps)) {
    if (!(basePropNames as Set<string>).has(propName)) {
      const get = createGetModelInstanceDataField(propData, propName)

      Object.defineProperty(ThisModel.prototype, propName, {
        get,
        set(value: unknown) {
          setFn(propData, propName, this, value)
        },
        enumerable: true,
        configurable: false,
      })
    }

    if (propData._setter === true) {
      const setterName = propNameToSetterName(propName)

      if (!(basePropNames as Set<string>).has(setterName)) {
        const newPropDescriptor: any = modelAction(ThisModel.prototype, setterName, {
          value: function (this: any, value: any) {
            this[propName] = value
          },
          writable: true,
          enumerable: false,
          configurable: false,
        })

        Object.defineProperty(ThisModel.prototype, setterName, newPropDescriptor)
      }
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
      if (modelInstance && !(modelInstance as any)[modelInitializedSymbol]) {
        return sn
      }

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
        newSn[propName] = withErrorPathSegment(propName, () =>
          propData._fromSnapshotProcessor!(sn[propName])
        )
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
        newSn[propName] = withErrorPathSegment(propName, () => propData._toSnapshotProcessor!(sn[propName]))
      }
    }
    return newSn
  }
}
