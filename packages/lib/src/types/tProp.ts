import { AnyModelProp, MaybeOptionalModelProp, OptionalModelProp, prop } from "../modelShared/prop"
import { lazy } from "../utils"
import {
  typesBoolean,
  typesNull,
  typesNumber,
  typesString,
  typesUndefined,
} from "./primitiveBased/typesPrimitive"
import { resolveStandardType, resolveTypeChecker } from "./resolveTypeChecker"
import type { AnyStandardType, AnyType, TypeToData, TypeToSnapshotIn } from "./schemas"
import { createCodecPropTransform, resolveCodecSupport } from "./utility/typesCodec"
import { typesOr } from "./utility/typesOr"
import type { TypeToStoredData } from "./utility/typeToStoredData"

const noDefaultValueSymbol = Symbol("noDefaultValue")

const tPropCache = new WeakMap<AnyStandardType, Map<unknown, AnyModelProp>>()

type AnyTypeOrArray = AnyType | ReadonlyArray<AnyType>

type StoredRequiredPropMetadata<TType extends AnyType> = {
  $storedValueType: TypeToStoredData<TType>
  $storedCreationValueType: TypeToStoredData<TType>
}

type TypedMaybeOptionalModelProp<TType extends AnyType> = MaybeOptionalModelProp<
  TypeToData<TType>
> &
  StoredRequiredPropMetadata<TType>

type TypedOptionalModelProp<TType extends AnyType> = OptionalModelProp<TypeToData<TType>> & {
  $storedValueType: TypeToStoredData<TType>
  $storedCreationValueType: TypeToStoredData<TType> | null | undefined
  $typedFromSnapshotOverride: TypeToSnapshotIn<TType> | null | undefined
}

function getOrCreateTProp(
  type: AnyStandardType,
  defKey: unknown,
  createTProp: () => AnyModelProp
): AnyModelProp {
  let defValueCache = tPropCache.get(type)
  if (!defValueCache) {
    defValueCache = new Map()
    tPropCache.set(type, defValueCache)
  }

  let prop = defValueCache.get(defKey)
  if (!prop) {
    prop = createTProp()
    defValueCache.set(defKey, prop)
  }

  return prop
}

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
export function tProp(defaultValue: string): TypedOptionalModelProp<typeof typesString>

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
export function tProp(defaultValue: number): TypedOptionalModelProp<typeof typesNumber>

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
export function tProp(defaultValue: boolean): TypedOptionalModelProp<typeof typesBoolean>

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
 * @template TType Type checker type.
 *
 * @param type Type checker.
 * @param defaultFn Default value generator function.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType,
  defaultFn: () => TypeToData<TType>
): TypedOptionalModelProp<TType>

/**
 * Defines a model property using array syntax as a shorthand for `types.or(...)`,
 * with an optional function to generate a default value if the input snapshot /
 * model creation data is `null` or `undefined`.
 *
 * Example:
 * ```ts
 * x: tProp([String, Number], () => 10) // equivalent to tProp(types.or(String, Number), () => 10)
 * ```
 *
 * @template TType Array of possible type checkers.
 *
 * @param type Array shorthand for `types.or(...)`.
 * @param defaultFn Default value generator function.
 * @returns
 */
export function tProp<TType extends ReadonlyArray<AnyType>>(
  type: TType,
  defaultFn: () => TypeToData<TType[number]>
): TypedOptionalModelProp<TType[number]>

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
 * @template TType Type checker type.
 *
 * @param type Type checker.
 * @param defaultValue Default value generator function.
 * @returns
 */
export function tProp<TType extends AnyType>(
  type: TType,
  defaultValue: TypeToData<TType>
): TypedOptionalModelProp<TType>

/**
 * Defines a model property using array syntax as a shorthand for `types.or(...)`,
 * with an optional default value if the input snapshot / model creation data is
 * `null` or `undefined`.
 *
 * Example:
 * ```ts
 * x: tProp([String, Number], "foo") // equivalent to tProp(types.or(String, Number), "foo")
 * ```
 *
 * @template TType Array of possible type checkers.
 *
 * @param type Array shorthand for `types.or(...)`.
 * @param defaultValue Default value.
 * @returns
 */
export function tProp<TType extends ReadonlyArray<AnyType>>(
  type: TType,
  defaultValue: TypeToData<TType[number]>
): TypedOptionalModelProp<TType[number]>

/**
 * Defines a model property with no default value and an associated type checker.
 *
 * Example:
 * ```ts
 * x: tProp(types.number) // a required number
 * x: tProp(types.maybe(types.number)) // an optional number, which defaults to undefined
 * ```
 *
 * @template TType Type checker type.
 *
 * @param type Type checker.
 * @returns
 */
export function tProp<TType extends AnyType>(type: TType): TypedMaybeOptionalModelProp<TType>

/**
 * Defines a model property with no default value using array syntax as a shorthand
 * for `types.or(...)`.
 *
 * Example:
 * ```ts
 * x: tProp([String, undefined]) // equivalent to tProp(types.or(String, undefined))
 * ```
 *
 * @template TType Array of possible type checkers.
 *
 * @param type Array shorthand for `types.or(...)`.
 * @returns
 */
export function tProp<TType extends ReadonlyArray<AnyType>>(
  type: TType
): TypedMaybeOptionalModelProp<TType[number]>

export function tProp(typeOrDefaultValue: any, def?: any): AnyModelProp {
  switch (typeof typeOrDefaultValue) {
    case "string":
      return tProp(typesString, typeOrDefaultValue)
    case "number":
      return tProp(typesNumber, typeOrDefaultValue)
    case "boolean":
      return tProp(typesBoolean, typeOrDefaultValue)
    default:
      break
  }

  const hasDefaultValue = arguments.length >= 2

  const typeOrArray: AnyTypeOrArray = typeOrDefaultValue
  const resolvedType: AnyType = Array.isArray(typeOrArray)
    ? typesOr(...(typeOrArray as ReadonlyArray<AnyType>))
    : (typeOrArray as AnyType)

  const typeChecker = resolveStandardType(resolvedType)
  const codecSupport = resolveCodecSupport(typeChecker)

  return getOrCreateTProp(typeChecker, hasDefaultValue ? def : noDefaultValueSymbol, () => {
    const fromSnapshotTypeChecker = hasDefaultValue
      ? typesOr(codecSupport.storedType, typesUndefined, typesNull)
      : codecSupport.storedType
    const getFromSnapshotProcessor = lazy(
      () => resolveTypeChecker(fromSnapshotTypeChecker).fromSnapshotProcessor
    )
    const getToSnapshotProcessor = lazy(
      () => resolveTypeChecker(codecSupport.storedType).toSnapshotProcessor
    )

    // we use Object.create to avoid messing up with the prop cache
    const baseProp = hasDefaultValue ? prop(def) : prop()
    const newProp = codecSupport.hasCodec
      ? baseProp.withTransform(createCodecPropTransform(typeChecker))
      : Object.create(baseProp)

    Object.assign(newProp, {
      _typeChecker: typeChecker,

      _fromSnapshotProcessor: (sn) => getFromSnapshotProcessor()(sn),

      _toSnapshotProcessor: (sn) => getToSnapshotProcessor()(sn),
    } satisfies Partial<AnyModelProp>)

    return newProp
  })
}
