import { failure } from "../utils"
import { typesBoolean, typesNull, typesNumber, typesString, typesUndefined } from "./primitives"
import { AnyStandardType, AnyType } from "./schemas"
import { isLateTypeChecker, LateTypeChecker, TypeChecker } from "./TypeChecker"

/**
 * @ignore
 */
export function resolveTypeChecker(v: AnyType | TypeChecker | LateTypeChecker): TypeChecker {
  let next: TypeChecker | LateTypeChecker = v as any
  while (true) {
    if (next instanceof TypeChecker) {
      return next
    } else if (v === String) {
      return typesString as any
    } else if (v === Number) {
      return typesNumber as any
    } else if (v === Boolean) {
      return typesBoolean as any
    } else if (v === null) {
      return typesNull as any
    } else if (v === undefined) {
      return typesUndefined as any
    } else if (isLateTypeChecker(next)) {
      next = next()
    } else {
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
  } else if (v === String) {
    return typesString as any
  } else if (v === Number) {
    return typesNumber as any
  } else if (v === Boolean) {
    return typesBoolean as any
  } else if (v === null) {
    return typesNull as any
  } else if (v === undefined) {
    return typesUndefined as any
  } else {
    throw failure("standard type could not be resolved")
  }
}
