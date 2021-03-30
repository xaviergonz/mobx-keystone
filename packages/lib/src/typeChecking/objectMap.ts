import { ObjectMap } from "../wrappers/ObjectMap"
import { getTypeInfo } from "./getTypeInfo"
import { typesObject } from "./object"
import { typesRecord } from "./record"
import { resolveStandardType, resolveTypeChecker } from "./resolveTypeChecker"
import type { AnyStandardType, AnyType, IdentityType, TypeToData } from "./schemas"
import { lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
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
 * @param valueType Value type.
 * @returns
 */
export function typesObjectMap<T extends AnyType>(
  valueType: T
): IdentityType<ObjectMap<TypeToData<T>>> {
  const typeInfoGen: TypeInfoGen = (t) => new ObjectMapTypeInfo(t, resolveStandardType(valueType))

  return lateTypeChecker(() => {
    const valueChecker = resolveTypeChecker(valueType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `ObjectMap<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const dataTypeChecker = typesObject(() => ({
      items: typesRecord(valueChecker as any),
    }))

    const thisTc: TypeChecker = new TypeChecker(
      (obj, path) => {
        if (!(obj instanceof ObjectMap)) {
          return new TypeCheckError(path, getTypeName(thisTc), obj)
        }

        const resolvedTc = resolveTypeChecker(dataTypeChecker)
        return resolvedTc.check(obj.$, path)
      },
      getTypeName,
      typeInfoGen
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.objectMap` type info.
 */
export class ObjectMapTypeInfo extends TypeInfo {
  get valueTypeInfo(): TypeInfo {
    return getTypeInfo(this.valueType)
  }

  constructor(thisType: AnyStandardType, readonly valueType: AnyStandardType) {
    super(thisType)
  }
}
