import type { Path } from "../parent/pathTypes"
import { isArray, isObject, isPrimitive, lazy } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import type { AnyStandardType } from "./schemas"
import { TypeCheckError } from "./TypeCheckError"

type CheckFunction = (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null

/**
 * @internal
 */
export enum TypeCheckerBaseType {
  Object = "object",
  Array = "array",
  Primitive = "primitive",
  Any = "any",
}

/**
 * @internal
 */
export function getTypeCheckerBaseTypeFromValue(value: any): TypeCheckerBaseType {
  // array must be before object since arrays are also objects
  if (isArray(value)) {
    return TypeCheckerBaseType.Array
  }
  if (isObject(value)) {
    return TypeCheckerBaseType.Object
  }
  if (isPrimitive(value)) {
    return TypeCheckerBaseType.Primitive
  }
  return TypeCheckerBaseType.Any
}

const typeCheckersWithCachedSnapshotProcessorResultsOfObject = new WeakMap<
  object,
  Set<TypeChecker>
>()

/**
 * @internal
 */
export function invalidateCachedToSnapshotProcessorResult(obj: object) {
  const set = typeCheckersWithCachedSnapshotProcessorResultsOfObject.get(obj)

  if (set) {
    set.forEach((typeChecker) => {
      typeChecker.invalidateSnapshotProcessorCachedResult(obj)
    })
    typeCheckersWithCachedSnapshotProcessorResultsOfObject.delete(obj)
  }
}

/**
 * @internal
 */
export class TypeChecker {
  unchecked: boolean

  check(value: any, path: Path, typeCheckedValue: any): TypeCheckError | null {
    if (this.unchecked) {
      return null
    }

    return this._check!(value, path, typeCheckedValue)
  }

  private _cachedTypeInfoGen: TypeInfoGen

  get typeInfo() {
    return this._cachedTypeInfoGen(this as any)
  }

  constructor(
    readonly baseType: TypeCheckerBaseType,
    private readonly _check: CheckFunction | null,
    readonly getTypeName: (...recursiveTypeCheckers: TypeChecker[]) => string,
    readonly typeInfoGen: TypeInfoGen,
    readonly snapshotType: (sn: unknown) => TypeChecker | null,
    private readonly _fromSnapshotProcessor: (sn: any) => unknown,
    private readonly _toSnapshotProcessor: (sn: any) => unknown
  ) {
    this.unchecked = !_check
    this._cachedTypeInfoGen = lazy(typeInfoGen)
  }

  fromSnapshotProcessor = (sn: any): unknown => {
    // we cannot cache fromSnapshotProcessor since nobody ensures us
    // the original snapshot won't be tweaked after use
    return this._fromSnapshotProcessor(sn)
  }

  private readonly _toSnapshotProcessorCache = new WeakMap<object, unknown>()

  invalidateSnapshotProcessorCachedResult(obj: object) {
    this._toSnapshotProcessorCache.delete(obj)
  }

  toSnapshotProcessor = (sn: any): unknown => {
    if (typeof sn !== "object" || sn === null) {
      // not cacheable
      return this._toSnapshotProcessor(sn)
    }

    if (this._toSnapshotProcessorCache.has(sn)) {
      return this._toSnapshotProcessorCache.get(sn)
    }

    const val = this._toSnapshotProcessor(sn)
    this._toSnapshotProcessorCache.set(sn, val)

    // register this type checker as listener of that sn changes
    const typeCheckerSet = getOrCreate(
      typeCheckersWithCachedSnapshotProcessorResultsOfObject,
      sn,
      () => new Set()
    )

    typeCheckerSet.add(this)

    return val
  }
}

const lateTypeCheckerSymbol = Symbol("lateTypeCheker")

/**
 * @internal
 */
export interface LateTypeChecker {
  [lateTypeCheckerSymbol]: true
  (): TypeChecker
  typeInfo: TypeInfo
}

/**
 * @internal
 */
export function lateTypeChecker(fn: () => TypeChecker, typeInfoGen: TypeInfoGen): LateTypeChecker {
  let cached: TypeChecker | undefined
  const ltc = () => {
    if (cached) {
      return cached
    }

    cached = fn()
    return cached
  }
  ;(ltc as LateTypeChecker)[lateTypeCheckerSymbol] = true

  const cachedTypeInfoGen = lazy(typeInfoGen)

  Object.defineProperty(ltc, "typeInfo", {
    enumerable: true,
    configurable: false,
    get() {
      return cachedTypeInfoGen(ltc as any)
    },
  })

  return ltc as LateTypeChecker
}

/**
 * @internal
 */
export function isLateTypeChecker(ltc: unknown): ltc is LateTypeChecker {
  return typeof ltc === "function" && lateTypeCheckerSymbol in ltc
}

/**
 * Type info base class.
 */
export class TypeInfo {
  readonly kind: string = "typeInfo"

  constructor(readonly thisType: AnyStandardType) {}
}

/**
 * @internal
 */
export type TypeInfoGen = (t: AnyStandardType) => TypeInfo
