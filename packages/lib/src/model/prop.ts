import { O } from "ts-toolbelt"
import { PropTransform } from "../propTransform/propTransform"
import { LateTypeChecker, TypeChecker } from "../typeChecking/TypeChecker"
import { IsOptionalValue } from "../utils/types"

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

export type ModelPropsToPropData<MP extends ModelProps> = {
  [k in keyof MP]: MP[k]["$propValueType"]
}

export type ModelPropsToPropCreationData<MP extends ModelProps> = O.Optional<
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
export function prop<TValue>(): ModelProp<TValue, TValue, IsOptionalValue<TValue, string, never>>

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
 * @returns
 */
export function prop<TValue>(
  defaultFn: () => TValue
): ModelProp<TValue, TValue | null | undefined, string>

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
 * @returns
 */
export function prop<TValue>(
  defaultValue: Exclude<TValue, object>
): ModelProp<TValue, TValue | null | undefined, string>

export function prop<TValue>(def?: any): ModelProp<TValue, any, any> {
  const hasDefaultValue = arguments.length > 0
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
  }
}
