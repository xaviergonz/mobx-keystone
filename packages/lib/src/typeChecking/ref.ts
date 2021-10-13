import { getGlobalConfig } from "../globalConfig/globalConfig"
import { modelTypeKey } from "../model/metadata"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { Ref, RefConstructor } from "../ref/Ref"
import { isObject } from "../utils"
import { typesObject } from "./object"
import { typesString } from "./primitives"
import { resolveTypeChecker } from "./resolveTypeChecker"
import type { IdentityType } from "./schemas"
import { TypeChecker, TypeCheckerBaseType, TypeInfo } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

/**
 * A type that represents a reference to an object or model.
 *
 * Example:
 * ```ts
 * const refToSomeObject = types.ref<SomeObject>()
 * ```
 *
 * @typeparam O Object or model type.
 * @param refConstructor Ref object type.
 * @returns
 */
export function typesRef<O extends object>(
  refConstructor: RefConstructor<O>
): IdentityType<Ref<O>> {
  const typeName = "Ref"

  const modelInfo = modelInfoByClass.get(refConstructor as any)!

  const refDataTypeChecker = resolveTypeChecker(
    typesObject(() => ({
      id: typesString,
    }))
  )

  const thisTc: TypeChecker = new TypeChecker(
    TypeCheckerBaseType.Object,

    (value, path) => {
      if (!(value instanceof Ref)) {
        return new TypeCheckError(path, typeName, value)
      }

      return refDataTypeChecker.check(value.$, path)
    },

    () => typeName,
    (t) => new RefTypeInfo(t),

    (obj) => {
      if (!isObject(obj)) {
        return null
      }

      if (obj[modelTypeKey] !== undefined) {
        // fast check
        return obj[modelTypeKey] === modelInfo.name ? thisTc : null
      }

      return refDataTypeChecker.snapshotType(obj) ? thisTc : null
    },

    (sn: Record<string, unknown>) => {
      if (sn[modelTypeKey]) {
        return sn
      } else {
        return {
          ...sn,
          [modelTypeKey]: modelInfo.name,
        }
      }
    },

    (sn) => {
      if (!getGlobalConfig().avoidModelTypeInTypedModelSnapshotsIfPossible) {
        return sn
      }

      const snCopy = {
        ...sn,
      }

      delete snCopy[modelTypeKey]

      return snCopy
    }
  )

  return thisTc as any
}

/**
 * `types.ref` type info.
 */
export class RefTypeInfo extends TypeInfo {}
