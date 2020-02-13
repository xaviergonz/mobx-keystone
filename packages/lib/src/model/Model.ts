import { O } from "ts-toolbelt"
import { memoTransformCache, PropTransform } from "../propTransform/propTransform"
import { typesObject } from "../typeChecking/object"
import { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { assertIsObject, failure } from "../utils"
import {
  AnyModel,
  BaseModel,
  baseModelPropNames,
  ModelClass,
  modelInitializedSymbol,
} from "./BaseModel"
import { modelIdKey, modelTypeKey } from "./metadata"
import {
  modelDataTypeCheckerSymbol,
  modelInitializersSymbol,
  modelPropertiesSymbol,
  modelUnwrappedClassSymbol,
} from "./modelSymbols"
import {
  ModelProps,
  ModelPropsToInstanceCreationData,
  ModelPropsToInstanceData,
  ModelPropsToPropsCreationData,
  ModelPropsToPropsData,
  OptionalModelProps,
} from "./prop"
import { assertIsModelClass } from "./utils"

declare const propsDataSymbol: unique symbol
declare const instanceDataSymbol: unique symbol

declare const optDataSymbol: unique symbol

declare const propsCreationDataSymbol: unique symbol
declare const instanceCreationDataSymbol: unique symbol

declare const composedPropsCreationDataSymbol: unique symbol
declare const composedInstanceCreationDataSymbol: unique symbol

export interface _Model<SuperModel, TProps extends ModelProps> {
  /**
   * Model type name assigned to this class, or undefined if none.
   */
  readonly [modelTypeKey]: string | undefined

  [propsDataSymbol]: ModelPropsToPropsData<TProps>
  [instanceDataSymbol]: ModelPropsToInstanceData<TProps>

  [optDataSymbol]: OptionalModelProps<TProps>

  [propsCreationDataSymbol]: ModelPropsToPropsCreationData<TProps>
  [instanceCreationDataSymbol]: ModelPropsToInstanceCreationData<TProps>

  [composedPropsCreationDataSymbol]: SuperModel extends BaseModel<any, infer CD>
    ? O.Merge<CD, this[typeof propsCreationDataSymbol]>
    : this[typeof propsCreationDataSymbol]
  [composedInstanceCreationDataSymbol]: SuperModel extends BaseModel<any, infer CD>
    ? O.Merge<CD, this[typeof instanceCreationDataSymbol]>
    : this[typeof instanceCreationDataSymbol]

  new (
    data: this[typeof composedInstanceCreationDataSymbol] & { [modelIdKey]?: string }
  ): SuperModel &
    BaseModel<
      this[typeof propsDataSymbol],
      this[typeof composedPropsCreationDataSymbol],
      this[typeof instanceDataSymbol],
      this[typeof composedInstanceCreationDataSymbol]
    > &
    Omit<this[typeof instanceDataSymbol], keyof AnyModel>
}

/**
 * Base abstract class for models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TBaseModel Base class type.
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @returns
 */
export function ExtendedModel<TProps extends ModelProps, TBaseModelClass>(
  baseModel: TBaseModelClass,
  modelProps: TProps
): _Model<TBaseModelClass & Object extends ModelClass<infer M> ? M : never, TProps> {
  // note that & Object is there to support abstract classes
  return internalModel<TProps, any>(modelProps, baseModel as any)
}

/**
 * Base abstract class for models.
 *
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param modelProps Model properties.
 */
export function Model<TProps extends ModelProps>(modelProps: TProps): _Model<unknown, TProps> {
  return internalModel(modelProps) as any
}

function internalModel<TProps extends ModelProps, TBaseModel extends AnyModel>(
  modelProps: TProps,
  baseModel?: ModelClass<TBaseModel>
): _Model<TBaseModel, TProps> {
  assertIsObject(modelProps, "modelProps")
  if (baseModel) {
    assertIsModelClass(baseModel as any, "baseModel")

    // if the baseModel is wrapped with the model decorator get the original one
    const unwrappedClass = (baseModel as any)[modelUnwrappedClassSymbol]
    if (unwrappedClass) {
      baseModel = unwrappedClass
      assertIsModelClass(baseModel as any, "baseModel")
    }
  }

  const extraDescriptors: PropertyDescriptorMap = {}

  const composedModelProps: ModelProps = modelProps
  if (baseModel) {
    const oldModelProps: ModelProps = (baseModel as any)[modelPropertiesSymbol]
    for (const oldModelPropKey of Object.keys(oldModelProps)) {
      if (modelProps[oldModelPropKey]) {
        throw failure(
          `extended model cannot redeclare base model property named '${oldModelPropKey}'`
        )
      }
      composedModelProps[oldModelPropKey] = oldModelProps[oldModelPropKey]
    }
  } else {
    // define $modelId on the base
    extraDescriptors[modelIdKey] = createModelPropDescriptor(modelIdKey, undefined, true)
  }

  // create type checker if needed
  let dataTypeChecker: LateTypeChecker | undefined
  if (Object.values(composedModelProps).some(mp => !!mp.typeChecker)) {
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
    mp => !baseModelPropNames.has(mp as any)
  )) {
    extraDescriptors[modelPropName] = createModelPropDescriptor(
      modelPropName,
      modelProps[modelPropName].transform,
      false
    )
  }

  const base: any = baseModel || BaseModel

  const propsWithTransform = Object.entries(modelProps)
    .filter(([_propName, prop]) => !!prop.transform)
    .map(([propName, prop]) => [propName, prop.transform!] as const)

  // we use this weird hack rather than just class CustomBaseModel extends base {}
  // in order to work around problems with ES5 classes extending ES6 classes
  // see https://github.com/xaviergonz/mobx-keystone/issues/15
  const CustomBaseModel: any = (function(_base) {
    _inheritsLoose(CustomBaseModel, _base)

    function CustomBaseModel(
      this: any,
      initialData: any,
      snapshotInitialData: any,
      modelConstructor: any,
      generateNewIds: any
    ) {
      return new base(
        initialData,
        snapshotInitialData,
        modelConstructor || this.constructor,
        generateNewIds,
        propsWithTransform
      )
    }

    return CustomBaseModel
  })(base)

  const initializers = base[modelInitializersSymbol]
  if (initializers) {
    CustomBaseModel[modelInitializersSymbol] = initializers.slice()
  }

  CustomBaseModel[modelPropertiesSymbol] = composedModelProps
  CustomBaseModel[modelDataTypeCheckerSymbol] = dataTypeChecker

  Object.defineProperties(CustomBaseModel.prototype, extraDescriptors)

  return CustomBaseModel
}

function _inheritsLoose(subClass: any, superClass: any) {
  subClass.prototype = Object.create(superClass.prototype)
  subClass.prototype.constructor = subClass
  subClass.__proto__ = superClass
}

function createModelPropDescriptor(
  modelPropName: string,
  transform: PropTransform<any, any> | undefined,
  enumerable: boolean
): PropertyDescriptor {
  // the code is duplicated to ensure better speed
  if (transform) {
    return {
      enumerable,
      configurable: true,
      get(this: AnyModel) {
        // no need to use get since these vars always get on the initial $
        const memoTransform = memoTransformCache.getOrCreateMemoTransform(
          this,
          modelPropName,
          transform
        )
        return memoTransform.propToData(this.$[modelPropName])
      },
      set(this: AnyModel, v?: any) {
        // hack to only permit setting these values once fully constructed
        // this is to ignore abstract properties being set by babel
        // see https://github.com/xaviergonz/mobx-keystone/issues/18
        if (!(this as any)[modelInitializedSymbol]) {
          return
        }
        // no need to use set since these vars always get on the initial $
        const memoTransform = memoTransformCache.getOrCreateMemoTransform(
          this,
          modelPropName,
          transform
        )
        const oldPropValue = this.$[modelPropName]
        this.$[modelPropName] = memoTransform.dataToProp(v, oldPropValue)
      },
    }
  } else {
    return {
      enumerable,
      configurable: true,
      get(this: AnyModel) {
        // no need to use get since these vars always get on the initial $
        return this.$[modelPropName]
      },
      set(this: AnyModel, v?: any) {
        // hack to only permit setting these values once fully constructed
        // this is to ignore abstract properties being set by babel
        // see https://github.com/xaviergonz/mobx-keystone/issues/18
        if (!(this as any)[modelInitializedSymbol]) {
          return
        }
        // no need to use set since these vars always get on the initial $
        this.$[modelPropName] = v
      },
    }
  }
}
