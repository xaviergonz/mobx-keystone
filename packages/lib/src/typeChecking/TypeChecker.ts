import { onPatches } from "../patch/emitPatch"
import { isTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { TypeCheckError } from "./TypeCheckError"

type CheckFunction = (value: any, path: ReadonlyArray<string | number>) => TypeCheckError | null

const emptyPath: ReadonlyArray<string | number> = []

/**
 * @ignore
 */
export class TypeChecker {
  private checkResultCache?: WeakMap<object, TypeCheckError | null | "outdated">

  unchecked: boolean

  check(value: any, path: ReadonlyArray<string | number>): TypeCheckError | null {
    if (this.unchecked) {
      return null
    }

    if (!isTweakedObject(value)) {
      return this._check!(value, path)
    }

    // optimized checking with cached values

    if (!this.checkResultCache) {
      this.checkResultCache = new WeakMap()
    }
    const checkResultCache = this.checkResultCache!

    let cachedResult = checkResultCache.get(value)

    if (cachedResult === undefined) {
      // not yet set up, set up type checking invalidation
      onPatches(value, () => {
        checkResultCache.set(value, "outdated")
      })
      cachedResult = "outdated"
    }

    if (cachedResult === "outdated") {
      // we set the path empty since the resoult could be used for another paths other than this base
      cachedResult = this._check!(value, emptyPath)
      checkResultCache.set(value, cachedResult)
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
  if (v instanceof TypeChecker) {
    return v
  }

  const typeChecker: TypeChecker = v()
  assertIsTypeChecker(typeChecker)
  return typeChecker
}

/**
 * @ignore
 */
export type LateTypeChecker = () => TypeChecker

/**
 * @ignore
 */
export function lateTypeChecker(fn: () => TypeChecker): LateTypeChecker {
  let cached: TypeChecker | undefined
  return () => {
    if (cached) {
      return cached
    }

    cached = fn()
    return cached
  }
}
