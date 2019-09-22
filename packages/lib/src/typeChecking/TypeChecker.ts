import { fastGetParentIncludingDataObjects } from "../parent/path"
import { isTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { TypeCheckError } from "./TypeCheckError"

type CheckFunction = (value: any, path: ReadonlyArray<string | number>) => TypeCheckError | null

const emptyPath: ReadonlyArray<string | number> = []

type CheckResult = TypeCheckError | null
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

  check(value: any, path: ReadonlyArray<string | number>): TypeCheckError | null {
    if (this.unchecked) {
      return null
    }

    if (!isTweakedObject(value, true)) {
      return this._check!(value, path)
    }

    // optimized checking with cached values

    let cachedResult = this.getCachedResult(value)

    if (cachedResult === undefined) {
      // we set the path empty since the resoult could be used for another paths other than this base
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

  constructor(
    private readonly _check: CheckFunction | null,
    readonly getTypeName: (...recursiveTypeCheckers: TypeChecker[]) => string
  ) {
    this.unchecked = !_check
  }
}

/**
 * @ignore
 */
export function assertIsTypeChecker(value: any) {
  if (!(value instanceof TypeChecker)) {
    throw failure("type checker expected")
  }
}

/**
 * @ignore
 */
export function resolveTypeChecker(v: any): TypeChecker {
  let next: TypeChecker | LateTypeChecker = v
  while (true) {
    if (next instanceof TypeChecker) {
      return next
    } else if (isLateTypeChecker(next)) {
      next = next()
    } else {
      throw failure("type checker could not be resolved")
    }
  }
}

const lateTypeCheckerSymbol = Symbol("lateTypeCheker")

/**
 * @ignore
 */
export interface LateTypeChecker {
  [lateTypeCheckerSymbol]: true
  (): TypeChecker
}

/**
 * @ignore
 */
export function lateTypeChecker(fn: () => TypeChecker): LateTypeChecker {
  let cached: TypeChecker | undefined
  const ltc = function() {
    if (cached) {
      return cached
    }

    cached = fn()
    return cached
  }
  ;(ltc as LateTypeChecker)[lateTypeCheckerSymbol] = true

  return ltc as LateTypeChecker
}

/**
 * @ignore
 */
export function isLateTypeChecker(ltc: any): ltc is LateTypeChecker {
  return typeof ltc === "function" && ltc[lateTypeCheckerSymbol]
}
