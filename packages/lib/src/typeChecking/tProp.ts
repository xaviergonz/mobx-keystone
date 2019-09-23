import { ModelProp } from "../model/prop"
import { IsOptionalValue } from "../utils/types"
import { typesBoolean, typesNumber, typesString } from "./primitives"
import { AnyType, TypeToData, TypeToDataOpt } from "./schemas"

/**
 * Defines a string model property with a default value.
 * Equivalent to `tProp(types.string, defaultValue)`.
 *
 * Example:
 * ```ts
 * x: tcProp("foo") // an optional string that will take the value `"foo"` when undefined.
 * ```
 *
 * @param defaultValue Default value.
 * @returns
 */
export function tProp(defaultValue: string): ModelProp<string, string>

/**
 * Defines a number model property with a default value.
 * Equivalent to `tProp(types.number, defaultValue)`.
 *
 * Example:
 * ```ts
 * x: tcProp(42) // an optional number that will take the value `42` when undefined.
 * ```
 *
 * @param defaultValue Default value.
 * @returns
 */
export function tProp(defaultValue: number): ModelProp<number, string>

/**
 * Defines a boolean model property with a default value.
 * Equivalent to `tProp(types.boolean, defaultValue)`.
 *
 * Example:
 * ```ts
 * x: tcProp(true) // an optional boolean that will take the value `true` when undefined.
 * ```
 *
 * @param defaultValue Default value.
 * @returns
 */
export function tProp(defaultValue: boolean): ModelProp<boolean, string>

/**
 * Defines a model property with no default value and an associated type checker.
 *
 * Example:
 * ```ts
 * x: tcProp(types.number) // a required number
 * x: tcProp(types.maybe(types.number)) // an optional number, which defaults to undefined
 * ```
 *
 * @typeparam TType Type checker type.
 *
 * @param type Type checker.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType
): ModelProp<TypeToData<TType>, IsOptionalValue<TypeToDataOpt<TType>, string, never>>

/**
 * Defines a model property, with an optional function to generate a default value
 * if not present and an associated type checker.
 *
 * Example:
 * ```ts
 * x: tcProp(types.number, () => 10) // an optional number, with a default value of 10
 * x: tcProp(types.array(types.number), () => []) // an optional number array, with a default empty array
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
): ModelProp<TypeToData<TType>, string>

/**
 * Defines a model property, with an optional default value
 * if not present and an associated type checker.
 * You should only use this with primitive values and never with object values
 * (array, model, object, etc).
 *
 * Example:
 * ```ts
 * x: tcProp(types.number, 10) // an optional number, with a default value of 10
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
  defaultValue: TypeToData<TType>
): ModelProp<TypeToData<TType>, string>

export function tProp(typeOrDefaultValue: any, def?: any): ModelProp<any, any> {
  switch (typeof typeOrDefaultValue) {
    case "string":
      return tProp(typesString, typeOrDefaultValue)
    case "number":
      return tProp(typesNumber, typeOrDefaultValue)
    case "boolean":
      return tProp(typesBoolean, typeOrDefaultValue)
  }

  const isDefFn = typeof def === "function"
  return {
    $valueType: null as any,
    $hasDefault: null as any,
    defaultFn: isDefFn ? def : undefined,
    defaultValue: isDefFn ? undefined : def,
    typeChecker: typeOrDefaultValue,
  }
}
