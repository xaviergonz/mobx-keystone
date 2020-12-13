import { Ref } from "../ref/Ref"
import { typesObject } from "./object"
import { typesString } from "./primitives"
import { resolveTypeChecker } from "./resolveTypeChecker"
import { IdentityType } from "./schemas"
import { TypeChecker, TypeInfo } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents a reference to an object or model.
 *
 * Example:
 * ```ts
 * const refToSomeObject = types.ref<SomeObject>()
 * ```
 *
 * @typeparam M Model type.
 * @returns
 */
export function typesRef<O extends object>(): IdentityType<Ref<O>> {
  return refTypeChecker as any
}

const typeName = "Ref"

const refDataTypeChecker = typesObject(() => ({
  id: typesString,
}))

const refTypeChecker = new TypeChecker(
  (value, path) => {
    if (!(value instanceof Ref)) {
      return new TypeCheckError(path, typeName, value)
    }

    const resolvedTc = resolveTypeChecker(refDataTypeChecker)
    return resolvedTc.check(value.$, path)
  },
  () => typeName,
  (t) => new RefTypeInfo(t)
)

/**
 * `types.ref` type info.
 */
export class RefTypeInfo extends TypeInfo {}
