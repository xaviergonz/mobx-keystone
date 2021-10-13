import { fastGetParentIncludingDataObjects } from "../parent/path"
import type { Path } from "../parent/pathTypes"
import { isTweakedObject } from "../tweaker/core"
import { failure, isArray, isObject, isPrimitive, lateVal } from "../utils"
import type { AnyStandardType } from "./schemas"
import { TypeCheckError } from "./TypeCheckError"

type CheckFunction = (value: any, path: Path) => TypeCheckError | null

const emptyPath: Path = []

type CheckResult = TypeCheckError | null
type CheckResultCache = WeakMap<object, CheckResult>

const typeCheckersWithCachedResultsOfObject = new WeakMap<object, Set<TypeChecker>>()

/**
 * @ignore
 * @internal
 */
export enum TypeCheckerBaseType {
  Object = "object",
  Array = "array",
  Primitive = "primitive",
  Any = "any",
}

/**
 * @ignore
 * @internal
 */
export function getTypeCheckerBaseTypeFromValue(value: any): TypeCheckerBaseType {
  if (isObject(value)) return TypeCheckerBaseType.Object
  else if (isArray(value)) return TypeCheckerBaseType.Array
  else if (isPrimitive(value)) return TypeCheckerBaseType.Primitive
  else return TypeCheckerBaseType.Any
}

/**
 * @ignore
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
 * @ignore
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
    readonly fromSnapshotProcessor: (sn: any) => unknown,
    // TODO: do we need a toSnapshotProcessor?
    readonly toSnapshotProcessor?: (sn: any) => unknown
  ) {
    this.unchecked = !_check
    this._cachedTypeInfoGen = lateVal(typeInfoGen)
  }
}

/**
 * @ignore
 * @internal
 */
export function assertIsTypeChecker(value: unknown): asserts value is TypeChecker {
  if (!(value instanceof TypeChecker)) {
    throw failure("type checker expected")
  }
}

const lateTypeCheckerSymbol = Symbol("lateTypeCheker")

/**
 * @ignore
 * @internal
 */
export interface LateTypeChecker {
  [lateTypeCheckerSymbol]: true
  (): TypeChecker
  typeInfo: TypeInfo
}

/**
 * @ignore
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

  const cachedTypeInfoGen = lateVal(typeInfoGen)

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
 * @ignore
 * @internal
 */
export function isLateTypeChecker(ltc: any): ltc is LateTypeChecker {
  return typeof ltc === "function" && ltc[lateTypeCheckerSymbol]
}

/**
 * Type info base class.
 */
export class TypeInfo {
  constructor(readonly thisType: AnyStandardType) {}
}

/**
 * @ignore
 * @internal
 */
export type TypeInfoGen = (t: AnyStandardType) => TypeInfo
