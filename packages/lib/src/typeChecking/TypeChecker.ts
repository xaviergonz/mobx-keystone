import { failure } from "../utils"
import { TypeCheckError } from "./TypeCheckError"

/**
 * @ignore
 */
export class TypeChecker {
  constructor(
    readonly check:
      | ((value: any, path: ReadonlyArray<string | number>) => TypeCheckError | null)
      | null,
    readonly getTypeName: (...recursiveTypeCheckers: TypeChecker[]) => string
  ) {}
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
