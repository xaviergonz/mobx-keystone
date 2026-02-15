import { AnyModelProp, MaybeOptionalModelProp, OptionalModelProp, prop } from "../modelShared/prop"
import {
  typesBoolean,
  typesNull,
  typesNumber,
  typesString,
  typesUndefined,
} from "./primitiveBased/typesPrimitive"
import { resolveStandardType, resolveTypeChecker } from "./resolveTypeChecker"
import type { AnyType, TypeToData } from "./schemas"
import { LateTypeChecker, TypeChecker } from "./TypeChecker"
import { typesOr } from "./utility/typesOr"

const noDefaultValueSymbol = Symbol("noDefaultValue")

const tPropCache = new WeakMap<TypeChecker | LateTypeChecker, Map<unknown, AnyModelProp>>()

type AnyTypeOrArray = AnyType | ReadonlyArray<AnyType>

function getOrCreateTProp(
  type: TypeChecker | LateTypeChecker,
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
export function tProp(defaultValue: string): OptionalModelProp<string>

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
export function tProp(defaultValue: number): OptionalModelProp<number>

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
export function tProp(defaultValue: boolean): OptionalModelProp<boolean>

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
): OptionalModelProp<TypeToData<TType>>

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
): OptionalModelProp<TypeToData<TType[number]>>

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
): OptionalModelProp<TypeToData<TType>>

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
): OptionalModelProp<TypeToData<TType[number]>>

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
export function tProp<TType extends AnyType>(type: TType): MaybeOptionalModelProp<TypeToData<TType>>

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
): MaybeOptionalModelProp<TypeToData<TType[number]>>

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

  const typeChecker = resolveStandardType(resolvedType) as unknown as
    | TypeChecker
    | LateTypeChecker

  return getOrCreateTProp(typeChecker, hasDefaultValue ? def : noDefaultValueSymbol, () => {
    const fromSnapshotTypeChecker = hasDefaultValue
      ? typesOr(typeChecker as unknown as AnyType, typesUndefined, typesNull)
      : typeChecker

    // we use Object.create to avoid messing up with the prop cache
    const newProp = Object.create(hasDefaultValue ? prop(def) : prop())

    Object.assign(newProp, {
      _typeChecker: typeChecker,

      _fromSnapshotProcessor: tPropFromSnapshotProcessor.bind(undefined, fromSnapshotTypeChecker),

      _toSnapshotProcessor: tPropToSnapshotProcessor.bind(undefined, typeChecker),
    } satisfies Partial<AnyModelProp>)

    return newProp
  })
}

function tPropFromSnapshotProcessor(
  fromSnapshotTypeChecker: AnyType | TypeChecker | LateTypeChecker,
  sn: unknown
): unknown {
  const fsnp = resolveTypeChecker(fromSnapshotTypeChecker).fromSnapshotProcessor
  return fsnp ? fsnp(sn) : sn
}

function tPropToSnapshotProcessor(
  typeChecker: AnyType | TypeChecker | LateTypeChecker,
  sn: unknown
): unknown {
  const tsnp = resolveTypeChecker(typeChecker).toSnapshotProcessor
  return tsnp ? tsnp(sn) : sn
}
