import type { O } from "ts-toolbelt"
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
  TIsId extends boolean = false,
  THasSetter = never
> {
  $valueType: TPropValue
  $creationValueType: TPropCreationValue
  $isOptional: TIsOptional
  $isId: TIsId
  $hasSetter: THasSetter

  defaultFn: (() => TPropValue) | typeof noDefaultValue
  defaultValue: TPropValue | typeof noDefaultValue
  typeChecker: TypeChecker | LateTypeChecker | undefined
  setter: boolean | "assign"

  withSetter(): ModelPropWithSetter<this>
  /**
   * @deprecated Setter methods are preferred.
   */
  withSetter(mode: "assign"): ModelPropWithSetter<this>
}

/**
 * Any model property.
 */
export type AnyModelProp = ModelProp<any, any, any, any, any>

/**
 * Model properties.
 */
export interface ModelProps {
  [k: string]: AnyModelProp
}

export type OptionalModelProps<MP extends ModelProps> = {
  [K in keyof MP]: MP[K]["$isOptional"] & K
}[keyof MP]

export type ModelPropsToData<MP extends ModelProps> = {
  [k in keyof MP]: MP[k]["$valueType"]
}

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use pick over the optional props we will loose the ability
// to infer generics
export type ModelPropsToCreationData<MP extends ModelProps> = {
  [k in keyof MP]?: MP[k]["$creationValueType"]
} &
  O.Omit<
    {
      [k in keyof MP]: MP[k]["$creationValueType"]
    },
    OptionalModelProps<MP>
  >

export type ModelPropsToSetter<MP extends ModelProps> = {
  [k in keyof MP as MP[k]["$hasSetter"] & `set${Capitalize<k & string>}`]: (
    value: MP[k]["$valueType"]
  ) => void
}

/**
 * A property that will be used as model id, replacing $modelId.
 * Can only be used in models and there can be only one per model.
 */
export const idProp = Symbol("idProp") as any as ModelProp<string, string, string, true>

/**
 * @ignore
 */
export type OnlyPrimitives<T> = Exclude<T, object>

/**
 * A model prop that maybe / maybe not is optional, depending on if the value can take undefined.
 */
export type MaybeOptionalModelProp<TPropValue> = ModelProp<
  TPropValue,
  TPropValue,
  IsOptionalValue<TPropValue, string, never>
>

/**
 * A model prop that is definitely optional.
 */
export type OptionalModelProp<TPropValue> = ModelProp<
  TPropValue,
  TPropValue | null | undefined,
  string
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
export function prop<TValue>(def?: any): ModelProp<TValue, any, any, any, any> {
  let hasDefaultValue = false

  // default
  if (arguments.length >= 1) {
    hasDefaultValue = true
  }

  const isDefFn = typeof def === "function"

  const obj: ReturnType<typeof prop> = {
    $valueType: null as any,
    $creationValueType: null as any,
    $isOptional: null as any,
    $isId: null as never,
    $hasSetter: null as never,

    defaultFn: hasDefaultValue && isDefFn ? def : noDefaultValue,
    defaultValue: hasDefaultValue && !isDefFn ? def : noDefaultValue,
    typeChecker: undefined,
    setter: false,

    withSetter(mode?: boolean | "assign") {
      return { ...obj, setter: mode ?? true }
    },
  }
  return obj as any
}
