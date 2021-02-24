import { ActionContextActionType } from "../action/context"
import { wrapInAction } from "../action/wrapInAction"
import { getGlobalConfig } from "../globalConfig"
import { memoTransformCache } from "../propTransform/propTransform"
import { typesObject } from "../typeChecking/object"
import { typesString } from "../typeChecking/primitives"
import { tProp } from "../typeChecking/tProp"
import { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { assertIsObject, failure, propNameToSetterActionName } from "../utils"
import {
  AbstractModelClass,
  AnyModel,
  BaseModel,
  baseModelPropNames,
  ModelClass,
  modelInitializedSymbol,
  ModelInstanceData,
} from "./BaseModel"
import { ModelMetadata } from "./getModelMetadata"
import { modelIdKey, modelTypeKey } from "./metadata"
import { modelInitializersSymbol } from "./modelClassInitializer"
import { ModelConstructorOptions } from "./ModelConstructorOptions"
import { getInternalModelClassPropsInfo, setInternalModelClassPropsInfo } from "./modelPropsInfo"
import { modelMetadataSymbol, modelUnwrappedClassSymbol } from "./modelSymbols"
import {
  AnyModelProp,
  idProp,
  ModelProps,
  ModelPropsToInstanceCreationData,
  ModelPropsToInstanceData,
  ModelPropsToPropsCreationData,
  ModelPropsToPropsData,
  ModelPropsToSetterActions,
  prop,
} from "./prop"
import { assertIsModelClass } from "./utils"

declare const propsDataSymbol: unique symbol
declare const instanceDataSymbol: unique symbol

declare const propsCreationDataSymbol: unique symbol
declare const instanceCreationDataSymbol: unique symbol

declare const composedInstanceCreationDataSymbol: unique symbol

export interface _Model<SuperModel, TProps extends ModelProps> {
  /**
   * Model type name assigned to this class, or undefined if none.
   */
  readonly [modelTypeKey]: string | undefined

  [propsDataSymbol]: ModelPropsToPropsData<TProps>
  [instanceDataSymbol]: ModelPropsToInstanceData<TProps>

  [propsCreationDataSymbol]: ModelPropsToPropsCreationData<TProps>
  [instanceCreationDataSymbol]: ModelPropsToInstanceCreationData<TProps>

  [composedInstanceCreationDataSymbol]: SuperModel extends BaseModel<any, any, any, infer ICD, any>
    ? this[typeof instanceCreationDataSymbol] & ICD
    : this[typeof instanceCreationDataSymbol]

  new (data: this[typeof composedInstanceCreationDataSymbol]): SuperModel &
    BaseModel<
      this[typeof propsDataSymbol],
      this[typeof propsCreationDataSymbol],
      this[typeof instanceDataSymbol],
      this[typeof instanceCreationDataSymbol],
      ExtractModelIdProp<TProps> & string
    > &
    Omit<this[typeof instanceDataSymbol], keyof AnyModel> &
    ModelPropsToSetterActions<TProps>
}

/**
 * @ignore
 * Ensures that a $modelId property is present if no idProp is provided.
 */
export type AddModelIdPropIfNeeded<
  TProps extends ModelProps
> = ExtractModelIdProp<TProps> extends never
  ? TProps & { $modelId: typeof idProp } // we use the actual name here to avoid having to re-export the original
  : TProps

/**
 * Extract the model id property from the model props.
 */
export type ExtractModelIdProp<TProps extends ModelProps> = {
  [K in keyof TProps]: TProps[K]["$isId"] extends true ? K : never
}[keyof TProps]

/**
 * Base abstract class for models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TModel Model type.
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @returns
 */
export function ExtendedModel<TProps extends ModelProps, TModel extends AnyModel>(
  baseModel: AbstractModelClass<TModel>,
  modelProps: TProps
): _Model<TModel, AddModelIdPropIfNeeded<TProps>> {
  assertIsModelClass(baseModel, "baseModel")

  // note that & Object is there to support abstract classes
  return internalModel(modelProps, baseModel as any)
}

/**
 * Base abstract class for models.
 *
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param modelProps Model properties.
 */
export function Model<TProps extends ModelProps>(
  modelProps: TProps
): _Model<unknown, AddModelIdPropIfNeeded<TProps>> {
  return internalModel(modelProps, undefined)
}

function internalModel<TProps extends ModelProps, TBaseModel extends AnyModel>(
  modelProps: TProps,
  baseModel: ModelClass<TBaseModel> | undefined
): _Model<TBaseModel, AddModelIdPropIfNeeded<TProps>> {
  assertIsObject(modelProps, "modelProps")
  if (baseModel) {
    assertIsModelClass(baseModel, "baseModel")

    // if the baseModel is wrapped with the model decorator get the original one
    const unwrappedClass = (baseModel as any)[modelUnwrappedClassSymbol]
    if (unwrappedClass) {
      baseModel = unwrappedClass
      assertIsModelClass(baseModel, "baseModel")
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
  if (idKeys.length > 1) {
    throw failure(`expected at most one idProp but got many: ${JSON.stringify(idKeys)}`)
  }
  if (idKeys.length <= 0) {
    idKeys.push(modelIdKey)
  }

  const needsTypeChecker = Object.values(composedModelProps).some((mp) => !!mp.typeChecker)

  // transform id keys (only one really)
  const idKey = idKeys[0]
  const idGenerator = () => getGlobalConfig().modelIdGenerator()
  composedModelProps[idKey] = needsTypeChecker ? tProp(typesString, idGenerator) : prop(idGenerator)

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

  // skip props that are on base model, these have to be accessed through $
  // we only need to proxy new props, not old ones
  for (const modelPropName of Object.keys(modelProps).filter(
    (mp) => !baseModelPropNames.has(mp as any)
  )) {
    extraDescriptors[modelPropName] = createModelPropDescriptor(
      modelPropName,
      modelProps[modelPropName],
      false
    )
  }

  const extraPropNames = Object.keys(extraDescriptors)
  const extraPropNamesLen = extraPropNames.length

  const base: any = baseModel ?? BaseModel

  const propsWithTransforms = Object.entries(modelProps)
    .filter(([_propName, prop]) => !!prop.transform)
    .map(([propName, prop]) => [propName, prop.transform!] as const)

  // we use this weird hack rather than just class CustomBaseModel extends base {}
  // in order to work around problems with ES5 classes extending ES6 classes
  // see https://github.com/xaviergonz/mobx-keystone/issues/15
  const CustomBaseModel: any = (function (_base) {
    _inheritsLoose(CustomBaseModel, _base)

    function CustomBaseModel(
      this: any,
      initialData: any,
      constructorOptions?: ModelConstructorOptions
    ) {
      const baseModel = new base(initialData, {
        ...constructorOptions,
        modelClass: constructorOptions?.modelClass ?? this.constructor,
        propsWithTransforms,
      } as ModelConstructorOptions)

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

  CustomBaseModel[modelMetadataSymbol] = {
    dataType: dataTypeChecker,
    modelIdProperty: idKey,
  } as ModelMetadata

  Object.defineProperties(CustomBaseModel.prototype, extraDescriptors)

  // add setter actions to prototype
  for (const [propName, propData] of Object.entries(modelProps)) {
    if (propData.options.setterAction) {
      const setterActionName = propNameToSetterActionName(propName)
      CustomBaseModel.prototype[setterActionName] = wrapInAction({
        name: setterActionName,
        fn: function (this: any, value: any) {
          this[propName] = value
        },
        actionType: ActionContextActionType.Sync,
      })
    }
  }

  return CustomBaseModel
}

function _inheritsLoose(subClass: any, superClass: any) {
  subClass.prototype = Object.create(superClass.prototype)
  subClass.prototype.constructor = subClass
  subClass.__proto__ = superClass
}

function createModelPropDescriptor(
  modelPropName: string,
  modelProp: AnyModelProp | undefined,
  enumerable: boolean
): PropertyDescriptor {
  return {
    enumerable,
    configurable: true,
    get(this: AnyModel) {
      return getModelInstanceDataField(this, modelProp, modelPropName)
    },
    set(this: AnyModel, v?: any) {
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

function getModelInstanceDataField<M extends AnyModel>(
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

function setModelInstanceDataField<M extends AnyModel>(
  model: M,
  modelProp: AnyModelProp | undefined,
  modelPropName: keyof ModelInstanceData<M>,
  value: ModelInstanceData<M>[typeof modelPropName]
): void {
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
