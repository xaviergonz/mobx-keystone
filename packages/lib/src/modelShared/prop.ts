import type { SnapshotInOf, SnapshotOutOf } from "../snapshot/SnapshotOf"
import type { LateTypeChecker, TypeChecker } from "../types/TypeChecker"
import { getOrCreate } from "../utils/mapUtils"
import type { Flatten, IsNeverType, IsOptionalValue } from "../utils/types"

/**
 * @internal
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
  THasSetter = never,
  TFromSnapshotOverride = never,
  TToSnapshotOverride = never
> {
  _internal: {
    $valueType: TPropValue
    $creationValueType: TPropCreationValue
    $transformedValueType: TTransformedValue
    $transformedCreationValueType: TTransformedCreationValue
    $isOptional: TIsOptional
    $isId: TIsId
    $hasSetter: THasSetter
    $fromSnapshotOverride: TFromSnapshotOverride
    $toSnapshotOverride: TToSnapshotOverride

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
    fromSnapshotProcessor?(sn: unknown): unknown
    toSnapshotProcessor?(sn: unknown): unknown
  }

  withSetter(): ModelProp<
    TPropValue,
    TPropCreationValue,
    TTransformedValue,
    TTransformedCreationValue,
    TIsOptional,
    TIsId,
    string,
    TFromSnapshotOverride,
    TToSnapshotOverride
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
    string,
    TFromSnapshotOverride,
    TToSnapshotOverride
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
    THasSetter,
    TFromSnapshotOverride,
    TToSnapshotOverride
  >

  withSnapshotProcessor<
    FS = TFromSnapshotOverride,
    TS = TToSnapshotOverride,
    This extends AnyModelProp = this
  >(processor: {
    fromSnapshot?(sn: FS): ModelPropFromSnapshot<This>
    toSnapshot?(sn: ModelPropToSnapshot<This>): TS
  }): ModelProp<
    TPropValue,
    TPropCreationValue,
    TTransformedValue,
    TTransformedCreationValue,
    TIsOptional,
    TIsId,
    THasSetter,
    FS,
    TS
  >
}

/**
 * The snapshot in type of a model property.
 */
export type ModelPropFromSnapshot<MP extends AnyModelProp> = IsNeverType<
  MP["_internal"]["$fromSnapshotOverride"],
  SnapshotInOf<MP["_internal"]["$creationValueType"]>,
  MP["_internal"]["$fromSnapshotOverride"]
>

/**
 * The snapshot out type of a model property.
 */
export type ModelPropToSnapshot<MP extends AnyModelProp> = IsNeverType<
  MP["_internal"]["$toSnapshotOverride"],
  SnapshotOutOf<MP["_internal"]["$valueType"]>,
  MP["_internal"]["$toSnapshotOverride"]
>

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
export type AnyModelProp = ModelProp<any, any, any, any, any, any, any, any, any>

/**
 * Model properties.
 */
export interface ModelProps {
  [k: string]: AnyModelProp
}

export type OptionalModelProps<MP extends ModelProps> = {
  [K in keyof MP]: MP[K]["_internal"]["$isOptional"] & K
}[keyof MP]

export type ModelPropsToData<MP extends ModelProps> = Flatten<{
  [k in keyof MP]: MP[k]["_internal"]["$valueType"]
}>

export type ModelPropsToSnapshotData<MP extends ModelProps> = Flatten<{
  [k in keyof MP]: ModelPropToSnapshot<MP[k]> extends infer R ? R : never
}>

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use pick over the optional props we will loose the ability
// to infer generics
export type ModelPropsToCreationData<MP extends ModelProps> = Flatten<
  {
    [k in keyof MP]?: MP[k]["_internal"]["$creationValueType"]
  } & Omit<
    {
      [k in keyof MP]: MP[k]["_internal"]["$creationValueType"]
    },
    OptionalModelProps<MP>
  >
>

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use pick over the optional props we will loose the ability
// to infer generics
export type ModelPropsToSnapshotCreationData<MP extends ModelProps> = Flatten<
  {
    [k in keyof MP]?: ModelPropFromSnapshot<MP[k]> extends infer R ? R : never
  } & Omit<
    {
      [k in keyof MP]: ModelPropFromSnapshot<MP[k]> extends infer R ? R : never
    },
    {
      [K in keyof MP]: IsNeverType<
        MP[K]["_internal"]["$fromSnapshotOverride"],
        MP[K]["_internal"]["$isOptional"] & K,
        IsOptionalValue<MP[K]["_internal"]["$fromSnapshotOverride"], K, never>
      >
    }[keyof MP]
  >
>

export type ModelPropsToTransformedData<MP extends ModelProps> = Flatten<{
  [k in keyof MP]: MP[k]["_internal"]["$transformedValueType"]
}>

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use pick over the optional props we will loose the ability
// to infer generics
export type ModelPropsToTransformedCreationData<MP extends ModelProps> = Flatten<
  {
    [k in keyof MP]?: MP[k]["_internal"]["$transformedCreationValueType"]
  } & Omit<
    {
      [k in keyof MP]: MP[k]["_internal"]["$transformedCreationValueType"]
    },
    OptionalModelProps<MP>
  >
>

export type ModelPropsToSetter<MP extends ModelProps> = Flatten<{
  [k in keyof MP as MP[k]["_internal"]["$hasSetter"] & `set${Capitalize<k & string>}`]: (
    value: MP[k]["_internal"]["$transformedValueType"]
  ) => void
}>

export type ModelIdProp = ModelProp<
  string,
  string | undefined,
  string,
  string | undefined,
  string,
  true
>

/**
 * A property that will be used as model id, accessible through $modelId.
 * Can only be used in models and there can be only one per model.
 */
export const idProp = {
  _internal: {
    setter: false,
    isId: true,
  },

  withSetter(mode?: boolean | "assign") {
    return { ...this, _internal: { ...this._internal, setter: mode ?? true } }
  },
} as any as ModelIdProp

/**
 * @internal
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
    _internal: {
      $valueType: null as any,
      $creationValueType: null as any,
      $transformedValueType: null as any,
      $transformedCreationValueType: null as any,
      $isOptional: null as any,
      $isId: null as never,
      $hasSetter: null as never,
      $fromSnapshotOverride: null as never,
      $toSnapshotOverride: null as never,

      defaultFn: hasDefaultValue && isDefFn ? def : noDefaultValue,
      defaultValue: hasDefaultValue && !isDefFn ? def : noDefaultValue,
      typeChecker: undefined,
      setter: false,
      isId: false,
      transform: undefined,
      fromSnapshotProcessor: undefined,
      toSnapshotProcessor: undefined,
    },

    withSetter(mode?: boolean | "assign") {
      return { ...this, _internal: { ...this._internal, setter: mode ?? true } }
    },

    withTransform(transform: ModelPropTransform<unknown, unknown>) {
      return { ...this, _internal: { ...this._internal, transform: toFullTransform(transform) } }
    },

    withSnapshotProcessor({ fromSnapshot, toSnapshot }) {
      let newFromSnapshot

      if (this._internal.fromSnapshotProcessor && fromSnapshot) {
        const oldFn = this._internal.fromSnapshotProcessor
        const newFn = fromSnapshot
        newFromSnapshot = (sn: any) => oldFn(newFn(sn))
      } else if (fromSnapshot) {
        newFromSnapshot = fromSnapshot
      } else {
        newFromSnapshot = this._internal.fromSnapshotProcessor
      }

      let newToSnapshot

      if (this._internal.toSnapshotProcessor && toSnapshot) {
        const oldFn: any = this._internal.toSnapshotProcessor
        const newFn = toSnapshot
        newToSnapshot = (sn: any) => newFn(oldFn(sn))
      } else if (toSnapshot) {
        newToSnapshot = toSnapshot
      } else {
        newToSnapshot = this._internal.toSnapshotProcessor
      }

      return {
        ...this,
        _internal: {
          ...this._internal,
          fromSnapshotProcessor: newFromSnapshot,
          toSnapshotProcessor: newToSnapshot,
        },
      }
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
