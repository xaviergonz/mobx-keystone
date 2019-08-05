import { ModelProp } from "../model/prop"
import { AnyType, TypeToData } from "./schemas"

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
): ModelProp<TypeToData<TType>, never, never>

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
): ModelProp<TypeToData<TType>, typeof defaultFn, never>

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
): ModelProp<TypeToData<TType>, never, TypeToData<TType>>

export function tProp<TType extends AnyType>(
  type: TType,
  def?: any
): ModelProp<TypeToData<TType>, any, any> {
  const isDefFn = typeof def === "function"
  return {
    $valueType: null as any,
    defaultFn: isDefFn ? def : undefined,
    defaultValue: isDefFn ? undefined : def,
    typeChecker: type as any,
  }
}
