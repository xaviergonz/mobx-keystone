import { LateTypeChecker, TypeChecker } from "../typeChecking/TypeChecker"
import { IsOptionalValue } from "../utils/types"

/**
 * @ignore
 */
export const noTypeChecker = Symbol("noTypeChecker")

/**
 * A model property.
 */
export interface ModelProp<TValue, THasDefault> {
  $valueType: TValue
  $hasDefault: THasDefault
  defaultFn?: () => TValue
  defaultValue?: TValue
  typeChecker: TypeChecker | LateTypeChecker | typeof noTypeChecker
}

/**
 * Model properties.
 */
export interface ModelProps {
  [k: string]: ModelProp<any, any>
}

export type OptionalModelProps<MP extends ModelProps> = {
  [K in keyof MP]: (MP[K]["$hasDefault"] & K)
}[keyof MP]

export type ModelPropsToData<MP extends ModelProps> = {
  [k in keyof MP]: MP[k]["$valueType"]
}

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
 * @returns
 */
export function prop<TValue>(): ModelProp<TValue, IsOptionalValue<TValue, string, never>>

/**
 * Defines a model property, with an optional function to generate a default value
 * if not present.
 *
 * Example:
 * ```ts
 * x: prop(() => 10) // an optional number, with a default value of 10
 * x: prop<number[]>(() => []) // an optional number array, with a default empty array
 * ```
 *
 * @typeparam TValue Value type.
 * @param defaultFn Default value generator function.
 * @returns
 */
export function prop<TValue>(defaultFn: () => TValue): ModelProp<TValue, string>

/**
 * Defines a model property, with an optional default value
 * if not present.
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
 * @returns
 */
export function prop<TValue>(defaultValue: TValue): ModelProp<TValue, string>

export function prop<TValue>(def?: any): ModelProp<TValue, any> {
  const isDefFn = typeof def === "function"
  return {
    $valueType: null as any,
    $hasDefault: null as any,
    defaultFn: isDefFn ? def : undefined,
    defaultValue: isDefFn ? undefined : def,
    typeChecker: noTypeChecker,
  }
}
