import { get, set } from "mobx"
import { O } from "ts-toolbelt"
import { typesObject } from "../typeChecking/object"
import { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { assertIsObject } from "../utils"
import { AnyModel, BaseModel, baseModelPropNames } from "./BaseModel"
import { modelDataTypeCheckerSymbol, modelPropertiesSymbol } from "./modelSymbols"
import { ModelProps, ModelPropsToData, OptionalModelProps } from "./prop"

declare const propsDataSymbol: unique symbol
declare const optPropsDataSymbol: unique symbol
declare const creationDataSymbol: unique symbol

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

const hiddenPropertyDescriptor: PropertyDescriptor = {
  enumerable: false,
  writable: true,
  configurable: true,
  value: undefined,
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
  assertIsObject(modelProps, "modelProps")

  // create type checker if needed
  let dataTypeChecker: LateTypeChecker | undefined
  if (Object.values(modelProps).some(mp => mp.typeChecker)) {
    const typeCheckerObj: {
      [k: string]: any
    } = {}
    for (const [k, mp] of Object.entries(modelProps)) {
      typeCheckerObj[k] = mp.typeChecker || typesUnchecked()
    }
    dataTypeChecker = typesObject(() => typeCheckerObj) as any
  }

  const extraDescriptors: PropertyDescriptorMap = {}

  // skip props that are on base model, these have to be accessed through $
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

  class CustomBaseModel extends BaseModel<any, any> {}
  ;(CustomBaseModel as any)[modelDataTypeCheckerSymbol] = dataTypeChecker

  // proxy returned object so data can be accessed through this
  const classProto: any = CustomBaseModel.prototype
  Object.defineProperty(classProto, modelPropertiesSymbol, hiddenPropertyDescriptor)
  classProto[modelPropertiesSymbol] = modelProps

  Object.defineProperty(classProto, modelDataTypeCheckerSymbol, hiddenPropertyDescriptor)
  classProto[modelDataTypeCheckerSymbol] = dataTypeChecker

  Object.defineProperties(classProto, extraDescriptors)

  return CustomBaseModel as any
}
