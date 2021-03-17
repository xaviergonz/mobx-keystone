import type { O } from "ts-toolbelt"
import type { PropTransform } from "../propTransform/propTransform"
import type { LateTypeChecker, TypeChecker } from "../typeChecking/TypeChecker"
import type { IsOptionalValue } from "../utils/types"

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
  TInstanceCreationValue = TPropCreationValue,
  TIsId extends boolean = false,
  THasSetter = never
> {
  $propValueType: TPropValue
  $propCreationValueType: TPropCreationValue
  $instanceValueType: TInstanceValue
  $instanceCreationValueType: TInstanceCreationValue
  $isOptional: TIsOptional
  $isId: TIsId
  $hasSetter: THasSetter

  defaultFn: (() => TPropValue) | typeof noDefaultValue
  defaultValue: TPropValue | typeof noDefaultValue
  typeChecker: TypeChecker | LateTypeChecker | undefined
  transform: PropTransform<any, any> | undefined
  setter: boolean | "assign"

  withSetter(mode?: boolean | "assign"): ModelPropWithSetter<this>
}

/**
 * Any model property.
 */
export type AnyModelProp = ModelProp<any, any, any, any, any, any, any>

/**
 * Model properties.
 */
export interface ModelProps {
  [k: string]: AnyModelProp
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

export type ModelPropsToSetter<MP extends ModelProps> = {
  [k in keyof MP as MP[k]["$hasSetter"] & `set${Capitalize<k & string>}`]: (
    value: MP[k]["$instanceValueType"]
  ) => void
}

/**
 * A property that will be used as model id, replacing $modelId.
 * Can only be used in models and there can be only one per model.
 */
export const idProp = (Symbol("idProp") as any) as ModelProp<
  string,
  string,
  string,
  string,
  string,
  true
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
 * A model prop with a generated setter.
 */
export type ModelPropWithSetter<MP extends AnyModelProp> = Omit<MP, "$hasSetter"> & {
  $hasSetter: string
}

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
export function prop<TValue>(defaultFn: () => TValue): OptionalModelProp<TValue>

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
export function prop<TValue>(defaultValue: OnlyPrimitives<TValue>): OptionalModelProp<TValue>

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
export function prop<TValue>(): MaybeOptionalModelProp<TValue>

// base
export function prop<TValue>(def?: any): ModelProp<TValue, any, any, TValue, any, any, any> {
  let hasDefaultValue = false

  // default
  if (arguments.length >= 1) {
    hasDefaultValue = true
  }

  const isDefFn = typeof def === "function"

  const obj: ReturnType<typeof prop> = {
    $propValueType: null as any,
    $propCreationValueType: null as any,
    $isOptional: null as any,
    $instanceValueType: null as any,
    $instanceCreationValueType: null as any,
    $isId: null as never,
    $hasSetter: null as never,

    defaultFn: hasDefaultValue && isDefFn ? def : noDefaultValue,
    defaultValue: hasDefaultValue && !isDefFn ? def : noDefaultValue,
    typeChecker: undefined,
    transform: undefined,
    setter: false,

    withSetter(mode) {
      return { ...obj, setter: mode ?? true }
    },
  }
  return obj as any
}
