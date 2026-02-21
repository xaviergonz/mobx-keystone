import type { Path } from "../parent/pathTypes"
import { failure } from "../utils"
import { resolveTypeChecker } from "./resolveTypeChecker"
import type { AnyType, TypeToData } from "./schemas"
import type { TypeCheckError } from "./TypeCheckError"
import {
  allTypeCheckScope,
  createTypeCheckScope,
  type TouchedChildren,
  type TypeCheckScope,
} from "./typeCheckScope"

/**
 * Checks if a value conforms to a given type.
 *
 * @template T Type.
 * @param type Type to check for.
 * @param value Value to check.
 * @returns A TypeError if the check fails or null if no error.
 */
export function typeCheck<T extends AnyType>(type: T, value: TypeToData<T>): TypeCheckError | null {
  return typeCheckInternal(type, value, undefined, "all")
}

/**
 * @internal
 */
export function typeCheckInternal<T extends AnyType>(
  type: T,
  value: TypeToData<T>,
  pathToChangedObj: Path | undefined,
  touchedChildren: TouchedChildren
): TypeCheckError | null {
  let typeCheckScope: TypeCheckScope

  if (pathToChangedObj === undefined) {
    if (touchedChildren !== "all") {
      throw failure("assertion failed: full internal type-check must use touchedChildren='all'")
    }
    typeCheckScope = allTypeCheckScope
  } else {
    typeCheckScope = createTypeCheckScope(pathToChangedObj, 0, touchedChildren)
  }

  const typeChecker = resolveTypeChecker(type)

  if (typeChecker.unchecked) {
    return null
  } else {
    return typeChecker.check(value, [], value, typeCheckScope)
  }
}
