import { get, observable, set } from "mobx"
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
import { assertIsModelClass } from "./utils"

declare const baseDataSymbol: unique symbol
declare const baseCreationDataSymbol: unique symbol
declare const propsDataSymbol: unique symbol
declare const optPropsDataSymbol: unique symbol
declare const creationDataSymbol: unique symbol

export interface _InheritedModel<TProps extends ModelProps, SuperModel extends AnyModel> {
  [baseDataSymbol]: SuperModel extends BaseModel<infer D, any> ? D : unknown
  [baseCreationDataSymbol]: SuperModel extends BaseModel<any, infer CD> ? CD : unknown

  [propsDataSymbol]: ModelPropsToData<TProps> & this[typeof baseDataSymbol]
  [optPropsDataSymbol]: OptionalModelProps<TProps>
  [creationDataSymbol]: O.Optional<this[typeof propsDataSymbol], this[typeof optPropsDataSymbol]> &
    this[typeof baseCreationDataSymbol]

  new (data: this[typeof creationDataSymbol]): BaseModel<
    this[typeof propsDataSymbol],
    this[typeof creationDataSymbol]
  > &
    Omit<this[typeof propsDataSymbol], keyof AnyModel> &
    SuperModel
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
 * Base abstract class for models that extend another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TBaseClass Base class type.
 * @typeparam TBaseProps Base model properties type.
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @returns
 */
export function ExtendsModel<
  TProps extends ModelProps,
  TBaseClass extends AnyModel,
  TBaseProps extends ModelProps
>(
  baseModel: ModelClass<TBaseClass>,
  modelProps: TProps
): _InheritedModel<TProps & TBaseProps, TBaseClass> {
  return internalModel<TProps, TBaseClass, TBaseProps>(modelProps, baseModel)
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

function internalModel<
  TProps extends ModelProps,
  TBaseClass extends AnyModel,
  TBaseProps extends ModelProps
>(
  modelProps: TProps,
  baseModel?: ModelClass<TBaseClass>
): _InheritedModel<TProps & TBaseProps, TBaseClass> {
  if (baseModel) {
    assertIsModelClass(baseModel as any, "baseModel")
  }
  assertIsObject(modelProps, "modelProps")

  const composedModelProps: ModelProps = baseModel
    ? {
        ...(baseModel as any)[modelPropertiesSymbol],
        ...modelProps,
      }
    : modelProps

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

  const modelPropertiesDesc: PropertyDescriptor = {
    enumerable: false,
    writable: true,
    configurable: true,
    value: composedModelProps,
  }
  const modelDataTypeCheckerDesc: PropertyDescriptor = {
    enumerable: false,
    writable: true,
    configurable: true,
    value: dataTypeChecker,
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

  const addCustomBaseModelData = (cbm: any) => {
    cbm[modelPropertiesSymbol] = composedModelProps
    cbm[modelDataTypeCheckerSymbol] = dataTypeChecker
  }

  const initProps = (obj: any) => {
    if (baseModel) {
      // already defined, no need to redefine
      obj[modelPropertiesSymbol] = modelPropertiesDesc
      obj[modelDataTypeCheckerSymbol] = dataTypeChecker
    } else {
      Object.defineProperty(obj, modelPropertiesSymbol, modelPropertiesDesc)
      Object.defineProperty(obj, modelDataTypeCheckerSymbol, modelDataTypeCheckerDesc)
    }

    Object.defineProperties(obj, extraDescriptors)
  }

  const initData = (obj: any, initialData: any, snapshotInitialData: any) => {
    const clazz: ModelClass<AnyModel> = obj.constructor as any

    if (!snapshotInitialData) {
      assertIsObject(initialData, "initialData")

      internalNewModel(
        obj,
        clazz,
        observable.object(initialData, undefined, { deep: false }),
        undefined
      )
    } else {
      internalNewModel(obj, clazz, undefined, snapshotInitialData)
    }
  }

  const base: any = baseModel || BaseModel
  class CustomBaseModel extends base {
    constructor(initialData: any, snapshotInitialData: any, isBase?: boolean) {
      if (baseModel) {
        super(initialData, snapshotInitialData, true)
      } else {
        super(modelConstructorSymbol)
      }

      initProps(this)
      console.log("isBase", isBase, this.constructor)
      if (!isBase) {
        initData(this, initialData, snapshotInitialData)
      }
    }
  }
  addCustomBaseModelData(CustomBaseModel)

  return CustomBaseModel as any
}
