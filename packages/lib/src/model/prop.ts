import { O } from "ts-toolbelt"
import { PropTransform } from "../propTransform/propTransform"
import { LateTypeChecker, TypeChecker } from "../typeChecking/TypeChecker"
import { isObject } from "../utils"
import { IsOptionalValue } from "../utils/types"

/**
 * Model property options.
 */
export interface ModelPropOptions {
  /**
   * Set to `true` to automatically wrap the property setter in a model action (defaults to `false`).
   */
  readonly setterAction?: boolean
}

/**
 * @ignore
 */
export const noDefaultValue = Symbol("noDefaultValue")

/**
 * A model property.
 */
export interface ModelProp<
  TPropValue,
  TPropCreationValue,
  TIsOptional,
  TInstanceValue = TPropValue,
  TInstanceCreationValue = TPropCreationValue
> {
  $propValueType: TPropValue
  $propCreationValueType: TPropCreationValue
  $instanceValueType: TInstanceValue
  $instanceCreationValueType: TInstanceCreationValue
  $isOptional: TIsOptional

  defaultFn: (() => TPropValue) | typeof noDefaultValue
  defaultValue: TPropValue | typeof noDefaultValue
  typeChecker: TypeChecker | LateTypeChecker | undefined
  transform: PropTransform<any, any> | undefined
  options: ModelPropOptions
}

/**
 * Model properties.
 */
export interface ModelProps {
  [k: string]: ModelProp<any, any, any>
}

export type OptionalModelProps<MP extends ModelProps> = {
  [K in keyof MP]: MP[K]["$isOptional"] & K
}[keyof MP]

export type ModelPropsToPropsData<MP extends ModelProps> = {
  [k in keyof MP]: MP[k]["$propValueType"]
}

export type ModelPropsToPropsCreationData<MP extends ModelProps> = O.Optional<
  {
    [k in keyof MP]: MP[k]["$propCreationValueType"]
  },
  OptionalModelProps<MP>
>

export type ModelPropsToInstanceData<MP extends ModelProps> = {
  [k in keyof MP]: MP[k]["$instanceValueType"]
}

export type ModelPropsToInstanceCreationData<MP extends ModelProps> = O.Optional<
  {
    [k in keyof MP]: MP[k]["$instanceCreationValueType"]
  },
  OptionalModelProps<MP>
>

/**
 * @ignore
 */
export type OnlyPrimitives<T> = Exclude<T, object>

/**
 * A model prop that maybe / maybe not is optional, depending on if the value can take undefined.
 */
export type MaybeOptionalModelProp<TPropValue, TInstanceValue = TPropValue> = ModelProp<
  TPropValue,
  TPropValue,
  IsOptionalValue<TPropValue, string, never>,
  TInstanceValue,
  TInstanceValue
>

/**
 * A model prop that is definitely optional.
 */
export type OptionalModelProp<TPropValue, TInstanceValue = TPropValue> = ModelProp<
  TPropValue,
  TPropValue | null | undefined,
  string,
  TInstanceValue,
  TInstanceValue | null | undefined
>

/**
 * Defines a model property, with an optional function to generate a default value
 * if the input snapshot / model creation data is `null` or `undefined`.
 *
 * Example:
 * ```ts
 * x: prop(() => 10) // an optional number, with a default value of 10
 * x: prop<number[]>(() => []) // an optional number array, with a default empty array
 * ```
 *
 * @typeparam TValue Value type.
 * @param defaultFn Default value generator function.
 * @param options Model property options.
 * @returns
 */
export function prop<TValue>(
  defaultFn: () => TValue,
  options?: ModelPropOptions
): OptionalModelProp<TValue>

/**
 * Defines a model property, with an optional default value
 * if the input snapshot / model creation data is `null` or `undefined`.
 * You should only use this with primitive values and never with object values
 * (array, model, object, etc).
 *
 * Example:
 * ```ts
 * x: prop(10) // an optional number, with a default value of 10
 * ```
 *
 * @typeparam TValue Value type.
 * @param defaultValue Default primitive value.
 * @param options Model property options.
 * @returns
 */
export function prop<TValue>(
  defaultValue: OnlyPrimitives<TValue>,
  options?: ModelPropOptions
): OptionalModelProp<TValue>

/**
 * Defines a model property with no default value.
 *
 * Example:
 * ```ts
 * x: prop<number>() // a required number
 * x: prop<number | undefined>() // an optional number, which defaults to undefined
 * ```
 *
 * @typeparam TValue Value type.
 * @param options Model property options.
 * @returns
 */
export function prop<TValue>(options?: ModelPropOptions): MaybeOptionalModelProp<TValue>

export function prop<TValue>(arg1?: any, arg2?: any): ModelProp<TValue, any, any> {
  let def: any
  let opts: ModelPropOptions = {}
  let hasDefaultValue = false

  if (arguments.length >= 2) {
    // default, options
    def = arg1
    hasDefaultValue = true
    opts = { ...arg2 }
  } else if (arguments.length === 1) {
    // default | options
    if (isObject(arg1)) {
      // options
      opts = { ...arg1 }
    } else {
      // default
      def = arg1
      hasDefaultValue = true
    }
  }

  const isDefFn = typeof def === "function"

  return {
    $propValueType: null as any,
    $propCreationValueType: null as any,
    $isOptional: null as any,
    $instanceValueType: null as any,
    $instanceCreationValueType: null as any,

    defaultFn: hasDefaultValue && isDefFn ? def : noDefaultValue,
    defaultValue: hasDefaultValue && !isDefFn ? def : noDefaultValue,
    typeChecker: undefined,
    transform: undefined,
    options: opts,
  }
}
