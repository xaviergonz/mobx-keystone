import type { Path, PathElement } from "../parent/pathTypes"
import { TypeCheckError } from "./TypeCheckError"

/**
 * Prefixes an existing type-check error path with one parent path segment.
 * @internal
 */
export function prependPathElementToTypeCheckError(
  valueError: TypeCheckError,
  path: Path,
  pathElement: PathElement,
  typeCheckedValue: any
): TypeCheckError {
  const fullPath =
    path.length > 0 ? [...path, pathElement, ...valueError.path] : [pathElement, ...valueError.path]

  return new TypeCheckError({
    path: fullPath,
    expectedTypeName: valueError.expectedTypeName,
    actualValue: valueError.actualValue,
    typeCheckedValue,
  })
}
