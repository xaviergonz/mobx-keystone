import { fastGetParentIncludingDataObjects } from "../parent/path"
import { Path } from "../parent/pathTypes"
import { isTweakedObject } from "../tweaker/core"
import { failure, lateVal } from "../utils"
import { resolveStandardType } from "./resolveTypeChecker"
import { AnyStandardType, AnyType } from "./schemas"
import { transformTypeCheckErrors, TypeCheckErrors } from "./TypeCheckErrors"

type CheckFunction = (value: any, path: Path) => TypeCheckErrors | null

const emptyPath: Path = []

type CheckResult = TypeCheckErrors | null
type CheckResultCache = WeakMap<object, CheckResult>

const typeCheckersWithCachedResultsOfObject = new WeakMap<object, Set<TypeChecker>>()

/**
 * @ignore
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

  check(value: any, path: Path): TypeCheckErrors | null {
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
      return transformTypeCheckErrors(cachedResult, (cachedError) => ({
        ...cachedError,
        path: [...path, ...cachedError.path],
      }))
    } else {
      return null
    }
  }

  private _cachedTypeInfoGen: TypeInfoGen

  get typeInfo() {
    return this._cachedTypeInfoGen(this as any)
  }

  constructor(
    private readonly _check: CheckFunction | null,
    readonly getTypeName: (...recursiveTypeCheckers: TypeChecker[]) => string,
    typeInfoGen: TypeInfoGen
  ) {
    this.unchecked = !_check
    this._cachedTypeInfoGen = lateVal(typeInfoGen)
  }
}

/**
 * @internal
 * @ignore
 */
export function assertIsTypeChecker(value: unknown): asserts value is TypeChecker {
  if (!(value instanceof TypeChecker)) {
    throw failure("type checker expected")
  }
}

const lateTypeCheckerSymbol = Symbol("lateTypeCheker")

/**
 * @ignore
 */
export interface LateTypeChecker {
  [lateTypeCheckerSymbol]: true
  (): TypeChecker
  typeInfo: TypeInfo
}

/**
 * @ignore
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
 */
export type TypeInfoGen = (t: AnyStandardType) => TypeInfo

/**
 * Gets the type info of a given type.
 *
 * @param type Type to get the info from.
 * @returns The type info.
 */
export function getTypeInfo(type: AnyType): TypeInfo {
  const stdType = resolveStandardType(type)
  const typeInfo = ((stdType as any) as TypeChecker | LateTypeChecker).typeInfo
  if (!typeInfo) {
    throw failure(`type info not found for ${type}`)
  }
  return typeInfo
}
