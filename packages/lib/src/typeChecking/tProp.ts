import { ModelProp, noDefaultValue } from "../model/prop"
import { IsOptionalValue } from "../utils/types"
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
 * @returns
 */
export function tProp(defaultValue: string): ModelProp<string, string | null | undefined, string>

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
 * @returns
 */
export function tProp(defaultValue: number): ModelProp<number, number | null | undefined, string>

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
 * @returns
 */
export function tProp(defaultValue: boolean): ModelProp<boolean, boolean | null | undefined, string>

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
 *
 * @param type Type checker.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType
): ModelProp<
  TypeToData<TType>,
  TypeToData<TType>,
  IsOptionalValue<TypeToData<TType>, string, never>
>

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
 *
 * @param type Type checker.
 * @param defaultFn Default value generator function.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType,
  defaultFn: () => TypeToData<TType>
): ModelProp<TypeToData<TType>, TypeToData<TType> | null | undefined, string>

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
 *
 * @param type Type checker.
 * @param defaultValue Default value generator function.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType,
  defaultValue: Exclude<TypeToData<TType>, object>
): ModelProp<TypeToData<TType>, TypeToData<TType> | null | undefined, string>

export function tProp(typeOrDefaultValue: any, def?: any): ModelProp<any, any, any> {
  switch (typeof typeOrDefaultValue) {
    case "string":
      return tProp(typesString, typeOrDefaultValue)
    case "number":
      return tProp(typesNumber, typeOrDefaultValue)
    case "boolean":
      return tProp(typesBoolean, typeOrDefaultValue)
  }

  const hasDefaultValue = arguments.length > 1
  const isDefFn = typeof def === "function"
  return {
    $propValueType: null as any,
    $propCreationValueType: null as any,
    $isOptional: null as any,
    $instanceValueType: null as any,
    $instanceCreationValueType: null as any,

    defaultFn: hasDefaultValue && isDefFn ? def : noDefaultValue,
    defaultValue: hasDefaultValue && !isDefFn ? def : noDefaultValue,
    typeChecker: resolveStandardType(typeOrDefaultValue) as any,
    transform: undefined,
  }
}
