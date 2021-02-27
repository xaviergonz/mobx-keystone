import { failure } from "../utils"
import type { AnyStandardType, AnyType } from "./schemas"
import { isLateTypeChecker, LateTypeChecker, TypeChecker } from "./TypeChecker"

const registeredStandardTypes = new Map<any, AnyStandardType>()

/**
 * @ignore
 */
export function registerStandardType(value: any, typeChecker: AnyStandardType) {
  registeredStandardTypes.set(value, typeChecker)
}

/**
 * @ignore
 */
export function resolveTypeChecker(v: AnyType | TypeChecker | LateTypeChecker): TypeChecker {
  let next: TypeChecker | LateTypeChecker = v as any
  while (true) {
    if (next instanceof TypeChecker) {
      return next
    } else if (isLateTypeChecker(next)) {
      next = next()
    } else {
      const tc = registeredStandardTypes.get(v)
      if (tc) {
        return tc as any
      }
      throw failure("type checker could not be resolved")
    }
  }
}

/**
 * @ignore
 */
export function resolveStandardType(v: AnyType | TypeChecker | LateTypeChecker): AnyStandardType {
  if (v instanceof TypeChecker || isLateTypeChecker(v)) {
    return v as any
  } else {
    const tc = registeredStandardTypes.get(v)
    if (tc) {
      return tc
    }
    throw failure("standard type could not be resolved")
  }
}
