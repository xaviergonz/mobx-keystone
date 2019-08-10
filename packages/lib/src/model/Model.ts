import { observable } from "mobx"
import { O } from "ts-toolbelt"
import { typesObject } from "../typeChecking/object"
import { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { assertIsObject } from "../utils"
import { AnyModel, BaseModel, baseModelPropNames, ModelClass } from "./BaseModel"
import { modelConstructorSymbol } from "./modelInfo"
import { modelDataTypeCheckerSymbol, modelPropertiesSymbol } from "./modelSymbols"
import { internalNewModel } from "./newModel"
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

  const modelPropertiesDesc: PropertyDescriptor = {
    enumerable: false,
    writable: false,
    configurable: true,
    value: modelProps,
  }
  const modelDataTypeCheckerDesc: PropertyDescriptor = {
    enumerable: false,
    writable: false,
    configurable: true,
    value: dataTypeChecker,
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
        return this.$[modelPropName]
      },
      set(this: AnyModel, v?: any) {
        this.$[modelPropName] = v
      },
    }
  }

  class CustomBaseModel extends BaseModel<any, any> {
    constructor(initialData: any, snapshotInitialData: any) {
      super(modelConstructorSymbol as any)

      // proxy returned object so data can be accessed through this
      const obj = this
      Object.defineProperty(obj, modelPropertiesSymbol, modelPropertiesDesc)
      Object.defineProperty(obj, modelDataTypeCheckerSymbol, modelDataTypeCheckerDesc)
      Object.defineProperties(obj, extraDescriptors)

      const clazz: ModelClass<AnyModel> = this.constructor as any

      if (!snapshotInitialData) {
        assertIsObject(initialData, "initialData")

        internalNewModel(
          this,
          clazz,
          observable.object(initialData, undefined, { deep: false }),
          undefined
        )
      } else {
        internalNewModel(this, clazz, undefined, snapshotInitialData)
      }
    }
  }
  ;(CustomBaseModel as any)[modelDataTypeCheckerSymbol] = dataTypeChecker

  return CustomBaseModel as any
}
