import {
  MaybeOptionalModelProp,
  ModelProp,
  ModelPropOptions,
  noDefaultValue,
  OnlyPrimitives,
  OptionalModelProp,
} from "../model/prop"
import { isObject } from "../utils"
import { typesBoolean, typesNumber, typesString } from "./primitives"
import { resolveStandardType } from "./resolveTypeChecker"
import { AnyType, TypeToData } from "./schemas"

/**
 * Defines a string model property with a default value.
 * Equivalent to `tProp(types.string, defaultValue)`.
 *
 * Example:
 * ```ts
 * x: tProp("foo") // an optional string that will take the value `"foo"` when undefined.
 * ```
 *
 * @param defaultValue Default value.
 * @param options Model property options.
 * @returns
 */
export function tProp(defaultValue: string, options?: ModelPropOptions): OptionalModelProp<string>

/**
 * Defines a number model property with a default value.
 * Equivalent to `tProp(types.number, defaultValue)`.
 *
 * Example:
 * ```ts
 * x: tProp(42) // an optional number that will take the value `42` when undefined.
 * ```
 *
 * @param defaultValue Default value.
 * @param options Model property options.
 * @returns
 */
export function tProp(defaultValue: number, options?: ModelPropOptions): OptionalModelProp<number>

/**
 * Defines a boolean model property with a default value.
 * Equivalent to `tProp(types.boolean, defaultValue)`.
 *
 * Example:
 * ```ts
 * x: tProp(true) // an optional boolean that will take the value `true` when undefined.
 * ```
 *
 * @param defaultValue Default value.
 * @param options Model property options.
 * @returns
 */
export function tProp(defaultValue: boolean, options?: ModelPropOptions): OptionalModelProp<boolean>

/**
 * Defines a model property, with an optional function to generate a default value
 * if the input snapshot / model creation data is `null` or `undefined` and with an associated type checker.
 *
 * Example:
 * ```ts
 * x: tProp(types.number, () => 10) // an optional number, with a default value of 10
 * x: tProp(types.array(types.number), () => []) // an optional number array, with a default empty array
 * ```
 *
 * @typeparam TType Type checker type.
 * @param type Type checker.
 * @param defaultFn Default value generator function.
 * @param options Model property options.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType,
  defaultFn: () => TypeToData<TType>,
  options?: ModelPropOptions
): OptionalModelProp<TypeToData<TType>>

/**
 * Defines a model property, with an optional default value
 * if the input snapshot / model creation data is `null` or `undefined` and with an associated type checker.
 * You should only use this with primitive values and never with object values
 * (array, model, object, etc).
 *
 * Example:
 * ```ts
 * x: tProp(types.number, 10) // an optional number, with a default value of 10
 * ```
 *
 * @typeparam TType Type checker type.
 * @param type Type checker.
 * @param defaultValue Default value generator function.
 * @param options Model property options.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType,
  defaultValue: OnlyPrimitives<TypeToData<TType>>,
  options?: ModelPropOptions
): OptionalModelProp<TypeToData<TType>>

/**
 * Defines a model property with no default value and an associated type checker.
 *
 * Example:
 * ```ts
 * x: tProp(types.number) // a required number
 * x: tProp(types.maybe(types.number)) // an optional number, which defaults to undefined
 * ```
 *
 * @typeparam TType Type checker type.
 * @param type Type checker.
 * @param options Model property options.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType,
  options?: ModelPropOptions
): MaybeOptionalModelProp<TypeToData<TType>>

export function tProp(typeOrDefaultValue: any, arg1?: any, arg2?: any): ModelProp<any, any, any> {
  let def: any
  let opts: ModelPropOptions = {}
  let hasDefaultValue = false

  switch (typeof typeOrDefaultValue) {
    case "string":
      return tProp(typesString, typeOrDefaultValue, arg1)
    case "number":
      return tProp(typesNumber, typeOrDefaultValue, arg1)
    case "boolean":
      return tProp(typesBoolean, typeOrDefaultValue, arg1)
  }

  if (arguments.length >= 3) {
    // type, default, options
    def = arg1
    hasDefaultValue = true
    opts = { ...arg2 }
  } else if (arguments.length === 2) {
    // type, default | options
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
    $isId: null as never,

    defaultFn: hasDefaultValue && isDefFn ? def : noDefaultValue,
    defaultValue: hasDefaultValue && !isDefFn ? def : noDefaultValue,
    typeChecker: resolveStandardType(typeOrDefaultValue) as any,
    transform: undefined,
    options: opts,
  }
}
