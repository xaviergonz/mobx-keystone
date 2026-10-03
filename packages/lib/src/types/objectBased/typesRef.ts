import { modelTypeKey } from "../../model/metadata"
import { isModel } from "../../model/utils"
import { modelInfoByClass } from "../../modelShared/modelInfo"
import type { Ref, RefConstructor } from "../../ref/Ref"
import { isObject } from "../../utils"
import {
  isModelInstanceOfModelName,
  isUnrelatedSnapshotModelType,
  snapshotModelTypeMatches,
} from "../modelTypeMatching"
import { typesString } from "../primitiveBased/typesPrimitive"
import { resolveTypeChecker } from "../resolveTypeChecker"
import { SnapshotTypeMismatchError } from "../SnapshotTypeMismatchError"
import type { ModelType } from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import { TypeChecker, TypeCheckerBaseType, TypeInfo } from "../TypeChecker"
import { typesObject } from "./typesObject"

/**
 * A type that represents a reference to an object or model.
 *
 * Example:
 * ```ts
 * const refToSomeObject = types.ref(SomeObject)
 * ```
 *
 * @template O Object or model type.
 * @param refConstructor Ref object type.
 * @returns
 */
export function typesRef<O extends object>(refConstructor: RefConstructor<O>): ModelType<Ref<O>> {
  const typeName = "Ref"

  const modelInfo = modelInfoByClass.get(refConstructor.refClass)!

  const refDataTypeChecker = resolveTypeChecker(
    typesObject(() => ({
      id: typesString,
    }))
  )

  const thisTc: TypeChecker = new TypeChecker(
    TypeCheckerBaseType.Object,

    (value, path, typeCheckedValue) => {
      if (
        !(value instanceof refConstructor.refClass) &&
        !(isModel(value) && isModelInstanceOfModelName(value, modelInfo.name))
      ) {
        return new TypeCheckError({
          path,
          expectedTypeName: typeName,
          actualValue: value,
          typeCheckedValue,
        })
      }

      return refDataTypeChecker.check(value.$, path, typeCheckedValue)
    },

    () => typeName,
    (t) => new RefTypeInfo(t),

    (obj) => {
      if (!isObject(obj)) {
        return null
      }

      const snModelType = obj[modelTypeKey]
      if (snModelType !== undefined) {
        // fast check
        return snapshotModelTypeMatches(snModelType, modelInfo.name) ? thisTc : null
      }

      return refDataTypeChecker.snapshotType(obj) ? thisTc : null
    },

    (sn: Record<string, unknown>) => {
      const snModelType = sn[modelTypeKey]
      if (snModelType) {
        // the snapshot names its own model; make sure it is this ref or a subclass of it
        if (isUnrelatedSnapshotModelType(snModelType, modelInfo.name)) {
          throw new SnapshotTypeMismatchError({
            expectedTypeName: typeName,
            actualValue: sn,
          })
        }
        return sn
      } else {
        return {
          ...sn,
          [modelTypeKey]: modelInfo.name,
        }
      }
    },

    undefined
  )

  return thisTc as any
}

/**
 * `types.ref` type info.
 */
export class RefTypeInfo extends TypeInfo {
  readonly kind = "ref"
}
