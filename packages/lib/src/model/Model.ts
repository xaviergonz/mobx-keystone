import { get, set } from "mobx"
import { O } from "ts-toolbelt"
import { typesObject } from "../typeChecking/object"
import { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { addHiddenProp, assertIsObject, failure } from "../utils"
import { AnyModel, BaseModel, baseModelPropNames, ModelClass } from "./BaseModel"
import { modelDataTypeCheckerSymbol, modelPropertiesSymbol } from "./modelSymbols"
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
        return get(this.$, modelPropName)
      },
      set(this: AnyModel, v?: any) {
        set(this.$, modelPropName, v)
      },
    }
  }

  const base: any = baseModel || BaseModel
  class CustomBaseModel extends base {}

  ;(CustomBaseModel as any)[modelPropertiesSymbol] = composedModelProps
  ;(CustomBaseModel as any)[modelDataTypeCheckerSymbol] = dataTypeChecker

  const obj = CustomBaseModel.prototype
  addHiddenProp(obj, modelPropertiesSymbol, composedModelProps, true)
  addHiddenProp(obj, modelDataTypeCheckerSymbol, dataTypeChecker, true)
  Object.defineProperties(obj, extraDescriptors)

  return CustomBaseModel as any
}
