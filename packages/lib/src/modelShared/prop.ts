import type { O } from "ts-toolbelt"
import type { LateTypeChecker, TypeChecker } from "../typeChecking/TypeChecker"
import { getOrCreate } from "../utils/mapUtils"
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
  TTransformedValue,
  TTransformedCreationValue,
  TIsOptional,
  TIsId extends boolean = false,
  THasSetter = never
> {
  $valueType: TPropValue
  $creationValueType: TPropCreationValue
  $transformedValueType: TTransformedValue
  $transformedCreationValueType: TTransformedCreationValue
  $isOptional: TIsOptional
  $isId: TIsId
  $hasSetter: THasSetter

  defaultFn: (() => TPropValue) | typeof noDefaultValue
  defaultValue: TPropValue | typeof noDefaultValue
  typeChecker: TypeChecker | LateTypeChecker | undefined
  setter: boolean | "assign"
  isId: boolean
  transform:
    | {
        transform(
          original: unknown,
          model: object,
          propName: PropertyKey,
          setOriginalValue: (newOriginalValue: unknown) => void
        ): unknown
        untransform(transformed: unknown, model: object, propName: PropertyKey): unknown
      }
    | undefined

  withSetter(): ModelProp<
    TPropValue,
    TPropCreationValue,
    TTransformedValue,
    TTransformedCreationValue,
    TIsOptional,
    TIsId,
    string
  >
  /**
   * @deprecated Setter methods are preferred.
   */
  withSetter(
    mode: "assign"
  ): ModelProp<
    TPropValue,
    TPropCreationValue,
    TTransformedValue,
    TTransformedCreationValue,
    TIsOptional,
    TIsId,
    string
  >

  /**
   * Sets a transform for the property instance value.
   *
   * @typeparam TTV Transformed value type.
   * @param transform Transform to be used.
   * @returns
   */
  withTransform<TTV>(
    transform: ModelPropTransform<NonNullable<TPropValue>, TTV>
  ): ModelProp<
    TPropValue,
    TPropCreationValue,
    TTV | Extract<TPropValue, null | undefined>,
    TTV | Extract<TPropCreationValue, null | undefined>,
    TIsOptional,
    TIsId,
    THasSetter
  >
}

/**
 * A model prop transform.
 */
export interface ModelPropTransform<TOriginal, TTransformed> {
  transform(params: {
    originalValue: TOriginal
    cachedTransformedValue: TTransformed | undefined
    setOriginalValue(value: TOriginal): void
  }): TTransformed

  untransform(params: { transformedValue: TTransformed; cacheTransformedValue(): void }): TOriginal
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

export type ModelPropsToData<MP extends ModelProps> = {
  [k in keyof MP]: MP[k]["$valueType"]
}

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use pick over the optional props we will loose the ability
// to infer generics
export type ModelPropsToCreationData<MP extends ModelProps> = {
  [k in keyof MP]?: MP[k]["$creationValueType"]
} & O.Omit<
  {
    [k in keyof MP]: MP[k]["$creationValueType"]
  },
  OptionalModelProps<MP>
>

export type ModelPropsToTransformedData<MP extends ModelProps> = {
  [k in keyof MP]: MP[k]["$transformedValueType"]
}

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use pick over the optional props we will loose the ability
// to infer generics
export type ModelPropsToTransformedCreationData<MP extends ModelProps> = {
  [k in keyof MP]?: MP[k]["$transformedCreationValueType"]
} & O.Omit<
  {
    [k in keyof MP]: MP[k]["$transformedCreationValueType"]
  },
  OptionalModelProps<MP>
>

export type ModelPropsToSetter<MP extends ModelProps> = {
  [k in keyof MP as MP[k]["$hasSetter"] & `set${Capitalize<k & string>}`]: (
    value: MP[k]["$transformedValueType"]
  ) => void
}

export type ModelIdProp = ModelProp<string, string, string, string, string, true>

/**
 * A property that will be used as model id, accessible through $modelId.
 * Can only be used in models and there can be only one per model.
 */
export const idProp = {
  setter: false,
  isId: true,

  withSetter(mode?: boolean | "assign") {
    return { ...this, setter: mode ?? true }
  },
} as any as ModelIdProp

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
  TPropValue,
  TPropValue | null | undefined,
  string
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
export function prop(def?: any): AnyModelProp {
  let hasDefaultValue = false

  // default
  if (arguments.length >= 1) {
    hasDefaultValue = true
  }

  const isDefFn = typeof def === "function"

  const obj: AnyModelProp = {
    $valueType: null as any,
    $creationValueType: null as any,
    $transformedValueType: null as any,
    $transformedCreationValueType: null as any,
    $isOptional: null as any,
    $isId: null as never,
    $hasSetter: null as never,

    defaultFn: hasDefaultValue && isDefFn ? def : noDefaultValue,
    defaultValue: hasDefaultValue && !isDefFn ? def : noDefaultValue,
    typeChecker: undefined,
    setter: false,
    isId: false,
    transform: undefined,

    withSetter(mode?: boolean | "assign") {
      return { ...this, setter: mode ?? true }
    },

    withTransform(transform: ModelPropTransform<unknown, unknown>) {
      return { ...this, transform: toFullTransform(transform) }
    },
  }

  return obj
}

let cacheTransformResult = false
const cacheTransformedValueFn = () => {
  cacheTransformResult = true
}

function toFullTransform(transformObject: ModelPropTransform<unknown, unknown>) {
  const cache = new WeakMap<
    object,
    Map<PropertyKey, { originalValue: unknown; transformedValue: unknown }>
  >()

  const transform = (params: {
    originalValue: unknown
    cachedTransformedValue: unknown
    setOriginalValue(newOriginalValue: unknown): void
  }) => (params.originalValue == null ? params.originalValue : transformObject.transform(params))

  const untransform = (params: { transformedValue: unknown; cacheTransformedValue(): void }) =>
    params.transformedValue == null ? params.transformedValue : transformObject.untransform(params)

  return {
    transform(
      originalValue: unknown,
      model: object,
      propName: PropertyKey,
      setOriginalValue: (newOriginalValue: unknown) => void
    ) {
      const modelCache = getOrCreate(cache, model, () => new Map())

      let propCache = modelCache.get(propName)
      if (propCache?.originalValue !== originalValue) {
        // original changed, invalidate cache
        modelCache.delete(propName)
        propCache = undefined
      }

      const transformedValue = transform({
        originalValue,
        cachedTransformedValue: propCache?.transformedValue,
        setOriginalValue,
      })

      modelCache.set(propName, {
        originalValue,
        transformedValue,
      })

      return transformedValue
    },

    untransform(transformedValue: unknown, model: object, propName: PropertyKey) {
      const modelCache = getOrCreate(cache, model, () => new Map())

      cacheTransformResult = false
      const originalValue = untransform({
        transformedValue,
        cacheTransformedValue: cacheTransformedValueFn,
      })
      if (cacheTransformResult) {
        modelCache.set(propName, { originalValue, transformedValue })
      } else {
        modelCache.delete(propName)
      }

      return originalValue
    },
  }
}
