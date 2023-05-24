import type { SnapshotInOf, SnapshotOutOf } from "../snapshot/SnapshotOf"
import type { LateTypeChecker, TypeChecker } from "../types/TypeChecker"
import { getOrCreate } from "../utils/mapUtils"
import type { Flatten, IsNeverType, IsOptionalValue } from "../utils/types"

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
  TIsRequired,
  TIsId extends boolean = false,
  THasSetter = never,
  TFromSnapshotOverride = never,
  TToSnapshotOverride = never
> {
  $valueType: TPropValue
  $creationValueType: TPropCreationValue
  $transformedValueType: TTransformedValue
  $transformedCreationValueType: TTransformedCreationValue
  $isRequired: TIsRequired
  $isId: TIsId
  $hasSetter: THasSetter
  $fromSnapshotOverride: TFromSnapshotOverride
  $toSnapshotOverride: TToSnapshotOverride

  _defaultFn: (() => TPropValue) | typeof noDefaultValue
  _defaultValue: TPropValue | typeof noDefaultValue
  _typeChecker: TypeChecker | LateTypeChecker | undefined
  _setter: boolean | "assign"
  _isId: boolean
  _transform:
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
  _fromSnapshotProcessor?(sn: unknown): unknown
  _toSnapshotProcessor?(sn: unknown): unknown

  withSetter(): ModelProp<
    TPropValue,
    TPropCreationValue,
    TTransformedValue,
    TTransformedCreationValue,
    TIsRequired,
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
    TIsRequired,
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
    TIsRequired,
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
    TIsRequired,
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
  MP["$fromSnapshotOverride"],
  SnapshotInOf<MP["$creationValueType"]>,
  MP["$fromSnapshotOverride"]
>

/**
 * The snapshot out type of a model property.
 */
export type ModelPropToSnapshot<MP extends AnyModelProp> = IsNeverType<
  MP["$toSnapshotOverride"],
  SnapshotOutOf<MP["$valueType"]>,
  MP["$toSnapshotOverride"]
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

export type RequiredModelProps<MP extends ModelProps> = {
  [K in keyof MP]: MP[K]["$isRequired"] & K
}[keyof MP]

export type ModelPropsToUntransformedData<MP extends ModelProps> = Flatten<{
  [k in keyof MP]: MP[k]["$valueType"]
}>

export type ModelPropsToSnapshotData<MP extends ModelProps> = Flatten<{
  [k in keyof MP]: ModelPropToSnapshot<MP[k]> extends infer R ? R : never
}>

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use Pick over the optional props we will loose the ability to infer generics
// we also don't use Flatten because if we do some generics won't work
export type ModelPropsToUntransformedCreationData<MP extends ModelProps> = {
  [k in keyof MP]?: MP[k]["$creationValueType"]
} & {
  [k in RequiredModelProps<MP>]: MP[k]["$creationValueType"]
}

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use Pick over the optional props we will loose the ability to infer generics
export type ModelPropsToSnapshotCreationData<MP extends ModelProps> = Flatten<
  {
    [k in keyof MP]?: ModelPropFromSnapshot<MP[k]> extends infer R ? R : never
  } & {
    [k in {
      [K in keyof MP]: IsNeverType<
        MP[K]["$fromSnapshotOverride"],
        MP[K]["$isRequired"] & K, // no override
        IsOptionalValue<MP[K]["$fromSnapshotOverride"], never, K> // with override
      >
    }[keyof MP]]: ModelPropFromSnapshot<MP[k]> extends infer R ? R : never
  }
>

export type ModelPropsToTransformedData<MP extends ModelProps> = Flatten<{
  [k in keyof MP]: MP[k]["$transformedValueType"]
}>

// we don't use O.Optional anymore since it generates unions too heavy
// also if we use Pick over the optional props we will loose the ability to infer generics
// we also don't use Flatten because if we do some generics won't work
// we also don't use Omit because if we do some generics won't work
export type ModelPropsToTransformedCreationData<MP extends ModelProps> = {
  [k in keyof MP]?: MP[k]["$transformedCreationValueType"]
} & {
  [k in RequiredModelProps<MP>]: MP[k]["$transformedCreationValueType"]
}

export type ModelPropsToSetter<MP extends ModelProps> = Flatten<{
  [k in keyof MP as MP[k]["$hasSetter"] & `set${Capitalize<k & string>}`]: (
    value: MP[k]["$transformedValueType"]
  ) => void
}>

export type ModelIdProp<T extends string = string> = ModelProp<
  T,
  T | undefined,
  T,
  T | undefined,
  never, // not required
  true
>

/**
 * A property that will be used as model id, accessible through $modelId.
 * Can only be used in models and there can be only one per model.
 */
export const idProp = {
  _setter: false,
  _isId: true,

  withSetter(mode?: boolean | "assign") {
    const obj: AnyModelProp = Object.create(this)
    obj._setter = mode ?? true
    return obj
  },

  typedAs() {
    return idProp
  },
} as any as ModelIdProp & {
  /**
   * Same as `idProp`, except that it might have an specific TypeScript string template as type.
   * E.g. `typedIdProp<`custom-${string}`>()`
   */
  typedAs<T extends string>(): ModelIdProp<T>
}

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
  IsOptionalValue<TPropValue, never, string> // calculate if required
>

/**
 * A model prop that is definitely optional.
 */
export type OptionalModelProp<TPropValue> = ModelProp<
  TPropValue,
  TPropValue | null | undefined,
  TPropValue,
  TPropValue | null | undefined,
  never // not required
>

const baseProp: AnyModelProp = {
  ...({} as Pick<
    AnyModelProp,
    | "$valueType"
    | "$creationValueType"
    | "$transformedValueType"
    | "$transformedCreationValueType"
    | "$isRequired"
    | "$isId"
    | "$hasSetter"
    | "$fromSnapshotOverride"
    | "$toSnapshotOverride"
  >),

  _defaultFn: noDefaultValue,
  _defaultValue: noDefaultValue,
  _typeChecker: undefined,
  _setter: false,
  _isId: false,
  _transform: undefined,
  _fromSnapshotProcessor: undefined,
  _toSnapshotProcessor: undefined,

  withSetter(mode?: boolean | "assign") {
    const obj: AnyModelProp = Object.create(this)
    obj._setter = mode ?? true
    return obj
  },

  withTransform(transform: ModelPropTransform<unknown, unknown>) {
    const obj: AnyModelProp = Object.create(this)
    obj._transform = toFullTransform(transform)
    return obj
  },

  withSnapshotProcessor({ fromSnapshot, toSnapshot }) {
    let newFromSnapshot

    if (this._fromSnapshotProcessor && fromSnapshot) {
      const oldFn = this._fromSnapshotProcessor
      const newFn = fromSnapshot
      newFromSnapshot = (sn: any) => oldFn(newFn(sn))
    } else if (fromSnapshot) {
      newFromSnapshot = fromSnapshot
    } else {
      newFromSnapshot = this._fromSnapshotProcessor
    }

    let newToSnapshot

    if (this._toSnapshotProcessor && toSnapshot) {
      const oldFn: any = this._toSnapshotProcessor
      const newFn = toSnapshot
      newToSnapshot = (sn: any) => newFn(oldFn(sn))
    } else if (toSnapshot) {
      newToSnapshot = toSnapshot
    } else {
      newToSnapshot = this._toSnapshotProcessor
    }

    const obj: AnyModelProp = Object.create(this)
    obj._fromSnapshotProcessor = newFromSnapshot
    obj._toSnapshotProcessor = newToSnapshot

    return obj
  },
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
export function prop(def?: any): AnyModelProp {
  const hasDefaultValue = arguments.length >= 1
  if (!hasDefaultValue) {
    return baseProp
  }

  let p = propCache.get(def)

  if (!p) {
    p = Object.create(baseProp)

    if (typeof def === "function") {
      p!._defaultFn = def
    } else {
      p!._defaultValue = def
    }

    propCache.set(def, p!)
  }

  return p!
}

const propCache = new Map<unknown, AnyModelProp>()

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

/**
 * @ignore
 */
export function getModelPropDefaultValue(propData: AnyModelProp): unknown | typeof noDefaultValue {
  if (propData._defaultFn !== noDefaultValue) {
    return propData._defaultFn()
  }

  if (propData._defaultValue !== noDefaultValue) {
    return propData._defaultValue
  }

  return noDefaultValue
}
