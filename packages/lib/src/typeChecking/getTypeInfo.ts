import { failure } from "../utils"
import { resolveStandardType } from "./resolveTypeChecker"
import type { AnyType } from "./schemas"
import type { LateTypeChecker, TypeChecker, TypeInfo } from "./TypeChecker"

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
