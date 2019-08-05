import { O } from "ts-toolbelt"
import { typesObject } from "../typeChecking/object"
import { LateTypeChecker } from "../typeChecking/TypeChecker"
import { typesUnchecked } from "../typeChecking/unchecked"
import { assertIsObject } from "../utils"
import { AnyModel, BaseModel, baseModelPropNames } from "./BaseModel"
import { modelConstructorSymbol } from "./modelInfo"
import { modelDataTypeCheckerSymbol, modelPropertiesSymbol } from "./modelSymbols"
import { ModelProps, ModelPropsToData, OptionalModelProps } from "./prop"

/**
 * Base abstract class for models.
 *
 * Never use new directly over models, use `newModel` function instead.
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param modelProps Model properties.
 */
export function Model<TProps extends ModelProps>(
  modelProps: TProps
): {
  new (privateSymbol: typeof modelConstructorSymbol): BaseModel<
    ModelPropsToData<TProps>,
    O.Optional<ModelPropsToData<TProps>, OptionalModelProps<TProps>>
  > &
    Omit<ModelPropsToData<TProps>, keyof AnyModel>
} {
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
    constructor(privateSymbol: typeof modelConstructorSymbol) {
      super(privateSymbol)

      // proxy returned object so data can be accessed through this
      const obj = this
      Object.defineProperty(obj, modelPropertiesSymbol, modelPropertiesDesc)
      Object.defineProperty(obj, modelDataTypeCheckerSymbol, modelDataTypeCheckerDesc)
      Object.defineProperties(obj, extraDescriptors)
    }
  }
  ;(CustomBaseModel as any)[modelDataTypeCheckerSymbol] = dataTypeChecker

  return CustomBaseModel as any
}
