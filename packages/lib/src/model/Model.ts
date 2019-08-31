import { O } from "ts-toolbelt"
import { typesObject } from "../typeChecking/object"
import { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { assertIsObject, failure } from "../utils"
import {
  AbstractModelClass,
  AnyModel,
  BaseModel,
  baseModelPropNames,
  ModelClass,
} from "./BaseModel"
import {
  modelDataTypeCheckerSymbol,
  modelInitializersSymbol,
  modelPropertiesSymbol,
} from "./modelSymbols"
import { ModelProps, ModelPropsToData, OptionalModelProps } from "./prop"
import { assertIsModelClass } from "./utils"

declare const propsDataSymbol: unique symbol
declare const optPropsDataSymbol: unique symbol
declare const creationDataSymbol: unique symbol
declare const composedCreationDataSymbol: unique symbol

export interface _ExtendedModel<SuperModel extends AnyModel, TProps extends ModelProps> {
  [propsDataSymbol]: ModelPropsToData<TProps>
  [optPropsDataSymbol]: OptionalModelProps<TProps>
  [creationDataSymbol]: O.Optional<this[typeof propsDataSymbol], this[typeof optPropsDataSymbol]>

  [composedCreationDataSymbol]: O.Merge<
    SuperModel extends BaseModel<any, infer CD> ? CD : unknown,
    this[typeof creationDataSymbol]
  >

  new (data: this[typeof composedCreationDataSymbol]): SuperModel &
    BaseModel<this[typeof propsDataSymbol], this[typeof creationDataSymbol]> &
    Omit<this[typeof propsDataSymbol], keyof AnyModel>
}

export interface _Model<TProps extends ModelProps> {
  [propsDataSymbol]: ModelPropsToData<TProps>
  [optPropsDataSymbol]: OptionalModelProps<TProps>
  [creationDataSymbol]: O.Optional<this[typeof propsDataSymbol], this[typeof optPropsDataSymbol]>

  new (data: this[typeof creationDataSymbol]): BaseModel<
    this[typeof propsDataSymbol],
    this[typeof creationDataSymbol]
  > &
    Omit<this[typeof propsDataSymbol], keyof AnyModel>
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
export function ExtendedModel<TProps extends ModelProps, TBaseModel extends AnyModel>(
  baseModel: ModelClass<TBaseModel>,
  modelProps: TProps
): _ExtendedModel<TBaseModel, TProps>

/**
 * Base abstract class for models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TBaseModel Base class type.
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @returns
 */
export function ExtendedModel<TProps extends ModelProps, TBaseModel extends AnyModel>(
  baseModel: AbstractModelClass<TBaseModel>,
  modelProps: TProps
): _ExtendedModel<TBaseModel, TProps>

/**
 * Base abstract class for models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TBaseModel Base class type.
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @returns
 */
export function ExtendedModel<TProps extends ModelProps, TBaseModel extends AnyModel>(
  baseModel: any,
  modelProps: TProps
): _ExtendedModel<TBaseModel, TProps> {
  return internalModel<TProps, TBaseModel>(modelProps, baseModel)
}

/**
 * Base abstract class for models.
 *
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param modelProps Model properties.
 */
export function Model<TProps extends ModelProps>(modelProps: TProps): _Model<TProps> {
  return internalModel(modelProps) as any
}

function internalModel<TProps extends ModelProps, TBaseModel extends AnyModel>(
  modelProps: TProps,
  baseModel?: ModelClass<TBaseModel>
): _ExtendedModel<TBaseModel, TProps> {
  assertIsObject(modelProps, "modelProps")
  if (baseModel) {
    assertIsModelClass(baseModel as any, "baseModel")
  }

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
  }

  // create type checker if needed
  let dataTypeChecker: LateTypeChecker | undefined
  if (Object.values(composedModelProps).some(mp => mp.typeChecker)) {
    const typeCheckerObj: {
      [k: string]: any
    } = {}
    for (const [k, mp] of Object.entries(composedModelProps)) {
      typeCheckerObj[k] = mp.typeChecker || typesUnchecked()
    }
    dataTypeChecker = typesObject(() => typeCheckerObj) as any
  }

  const extraDescriptors: PropertyDescriptorMap = {}

  // skip props that are on base model, these have to be accessed through $
  // we only need to proxy new props, not old ones
  for (const modelPropName of Object.keys(modelProps).filter(
    mp => !baseModelPropNames.has(mp as any)
  )) {
    extraDescriptors[modelPropName] = {
      enumerable: false,
      configurable: true,
      get(this: AnyModel) {
        // no need to use get since these vars always get on the initial $
        return this.$[modelPropName]
      },
      set(this: AnyModel, v?: any) {
        // no need to use set since these vars always get on the initial $
        this.$[modelPropName] = v
      },
    }
  }

  const base: any = baseModel || BaseModel

  const CustomBaseModel: any = (function(_base) {
    _inheritsLoose(CustomBaseModel, _base)

    function CustomBaseModel(
      this: any,
      initialData: any,
      snapshotInitialData: any,
      modelConstructor: any
    ) {
      return new base(initialData, snapshotInitialData, modelConstructor || this.constructor)
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
