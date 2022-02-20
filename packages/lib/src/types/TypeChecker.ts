import { fastGetParentIncludingDataObjects } from "../parent/path"
import type { Path } from "../parent/pathTypes"
import { isTweakedObject } from "../tweaker/core"
import { isArray, isObject, isPrimitive, lazy } from "../utils"
import type { AnyStandardType } from "./schemas"
import { TypeCheckError } from "./TypeCheckError"

type CheckFunction = (value: any, path: Path) => TypeCheckError | null

const emptyPath: Path = []

type CheckResult = TypeCheckError | null
type CheckResultCache = WeakMap<object, CheckResult>

const typeCheckersWithCachedResultsOfObject = new WeakMap<object, Set<TypeChecker>>()

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
  if (isObject(value)) return TypeCheckerBaseType.Object
  else if (isArray(value)) return TypeCheckerBaseType.Array
  else if (isPrimitive(value)) return TypeCheckerBaseType.Primitive
  else return TypeCheckerBaseType.Any
}

/**
 * @internal
 */
export function invalidateCachedTypeCheckerResult(obj: object) {
  // we need to invalidate it for the object and all its parents
  let current: any = obj
  while (current) {
    const set = typeCheckersWithCachedResultsOfObject.get(current)
    if (set) {
      for (const typeChecker of set) {
        typeChecker.invalidateCachedResult(current)
      }
      typeCheckersWithCachedResultsOfObject.delete(current)
    }

    current = fastGetParentIncludingDataObjects(current)
  }
}

/**
 * @internal
 */
export class TypeChecker {
  private checkResultCache?: CheckResultCache

  unchecked: boolean

  private createCacheIfNeeded(): CheckResultCache {
    if (!this.checkResultCache) {
      this.checkResultCache = new WeakMap()
    }
    return this.checkResultCache
  }

  setCachedResult(obj: object, newCacheValue: CheckResult) {
    this.createCacheIfNeeded().set(obj, newCacheValue)

    // register this type checker as listener of that object changes
    let typeCheckerSet = typeCheckersWithCachedResultsOfObject.get(obj)
    if (!typeCheckerSet) {
      typeCheckerSet = new Set()
      typeCheckersWithCachedResultsOfObject.set(obj, typeCheckerSet)
    }

    typeCheckerSet.add(this)
  }

  invalidateCachedResult(obj: object) {
    if (this.checkResultCache) {
      this.checkResultCache.delete(obj)
    }
  }

  private getCachedResult(obj: object): CheckResult | undefined {
    return this.checkResultCache ? this.checkResultCache.get(obj) : undefined
  }

  check(value: any, path: Path): TypeCheckError | null {
    if (this.unchecked) {
      return null
    }

    if (!isTweakedObject(value, true)) {
      return this._check!(value, path)
    }

    // optimized checking with cached values

    let cachedResult = this.getCachedResult(value)

    if (cachedResult === undefined) {
      // we set the path empty since the result could be used for paths other than this base
      cachedResult = this._check!(value, emptyPath)
      this.setCachedResult(value, cachedResult)
    }

    if (cachedResult) {
      return new TypeCheckError(
        [...path, ...cachedResult.path],
        cachedResult.expectedTypeName,
        cachedResult.actualValue
      )
    } else {
      return null
    }
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
  const ltc = function () {
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
    configurable: true,
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
  constructor(readonly thisType: AnyStandardType) {}
}

/**
 * @internal
 */
export type TypeInfoGen = (t: AnyStandardType) => TypeInfo
