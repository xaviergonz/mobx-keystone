import { failure } from "../utils"
import type { AnyStandardType, AnyType } from "./schemas"
import { isLateTypeChecker, LateTypeChecker, TypeChecker } from "./TypeChecker"

type StandardTypeResolverFn = (value: any) => AnyStandardType | undefined

const standardTypeResolvers: StandardTypeResolverFn[] = []

/**
 * @internal
 */
export function registerStandardTypeResolver(resolverFn: StandardTypeResolverFn) {
  standardTypeResolvers.push(resolverFn)
}

function findStandardType(value: any): AnyStandardType | undefined {
  for (const resolverFn of standardTypeResolvers) {
    const tc = resolverFn(value)
    if (tc) return tc
  }
  return undefined
}

/**
 * @internal
 */
export function resolveTypeChecker(v: AnyType | TypeChecker | LateTypeChecker): TypeChecker {
  let next: TypeChecker | LateTypeChecker = v as any
  while (true) {
    if (next instanceof TypeChecker) {
      return next
    } else if (isLateTypeChecker(next)) {
      next = next()
    } else {
      const tc = findStandardType(v)
      if (tc) {
        return resolveTypeChecker(tc)
      }
      throw failure("type checker could not be resolved")
    }
  }
}

/**
 * @internal
 */
export function resolveStandardTypeNoThrow(
  v: AnyType | TypeChecker | LateTypeChecker
): AnyStandardType | undefined {
  if (v instanceof TypeChecker || isLateTypeChecker(v)) {
    return v as any
  } else {
    const tc = findStandardType(v)
    if (tc) {
      return tc
    }
    return undefined
  }
}

/**
 * @internal
 */
export function resolveStandardType(v: AnyType | TypeChecker | LateTypeChecker): AnyStandardType {
  const tc = resolveStandardTypeNoThrow(v)
  if (tc) {
    return tc
  }
  throw failure("standard type could not be resolved")
}
