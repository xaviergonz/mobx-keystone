import { ObjectMap } from "../wrappers/ObjectMap"
import { typesObject } from "./object"
import { typesRecord } from "./record"
import { resolveTypeChecker } from "./resolveTypeChecker"
import { AnyType, IdentityType, TypeToData } from "./schemas"
import { lateTypeChecker, TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents an object-like map ObjectMap.
 *
 * Example:
 * ```ts
 * const numberMapType = types.objectMap(types.number)
 * ```
 *
 * @typeparam T Value type.
 * @param values Value type.
 * @returns
 */
export function typesObjectMap<T extends AnyType>(
  values: T
): IdentityType<ObjectMap<TypeToData<T>>> {
  return lateTypeChecker(() => {
    const valueChecker = resolveTypeChecker(values)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `ObjectMap<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const thisTc: TypeChecker = new TypeChecker((obj, path) => {
      if (!(obj instanceof ObjectMap)) {
        return new TypeCheckError(path, getTypeName(thisTc), obj)
      }

      const dataTypeChecker = typesObject(() => ({
        items: typesRecord(valueChecker as any),
      }))

      const resolvedTc = resolveTypeChecker(dataTypeChecker)
      return resolvedTc.check(obj.$, path)
    }, getTypeName)

    return thisTc
  }) as any
}
