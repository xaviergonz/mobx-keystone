import { isObservableObject, keys } from "mobx"
import type { Path } from "../../parent/pathTypes"
import { failure, isObject } from "../../utils"
import { withErrorPathSegment } from "../../utils/errorDiagnostics"
import { createPerEntryCachedCheck, recordCachePruning } from "../createPerEntryCachedCheck"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, RecordType } from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import {
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import { prependPathElementToTypeCheckError } from "../typeCheckErrorUtils"

/**
 * A type that represents an object-like map, an object with string keys and values all of a same given type.
 *
 * Example:
 * ```ts
 * // { [k: string]: number }
 * const numberMapType = types.record(types.number)
 * ```
 *
 * @template T Type.
 * @param valueType Type of the values of the object-like map.
 * @returns
 */
export function typesRecord<T extends AnyType>(valueType: T): RecordType<T> {
  const typeInfoGen: TypeInfoGen = (tc) => new RecordTypeInfo(tc, resolveStandardType(valueType))

  return lateTypeChecker(() => {
    const valueChecker = resolveTypeChecker(valueType)
    const emptyChildPath: Path = []

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) =>
      `Record<${valueChecker.getTypeName(...recursiveTypeCheckers, valueChecker)}>`

    const applySnapshotProcessor = (obj: Record<string, unknown>, mode: "from" | "to") => {
      if (valueChecker.unchecked) {
        return obj
      }

      const newObj: typeof obj = {}

      const keys = Object.keys(obj)
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        const v = withErrorPathSegment(k, () =>
          mode === "from"
            ? valueChecker.fromSnapshotProcessor(obj[k])
            : valueChecker.toSnapshotProcessor(obj[k])
        )
        newObj[k] = v
      }

      return newObj
    }

    const checkRecordValues = createPerEntryCachedCheck(
      (obj, checkEntry) => {
        // Use keys() from MobX for observable objects to track key additions/removals
        // in MobX 4 (which lacks Proxy). Object.keys() doesn't establish MobX tracking
        // in MobX 4, so the aggregation computed would miss newly added keys.
        const objKeys = isObservableObject(obj) ? keys(obj) : Object.keys(obj)
        for (let i = 0; i < objKeys.length; i++) {
          const error = checkEntry(objKeys[i])
          if (error) return error
        }
        return null
      },
      (obj, key, path, typeCheckedValue) => {
        if (typeof key !== "string") {
          throw failure(`record type keys must be strings, got ${typeof key}`)
        }
        const error = valueChecker.check(obj[key], emptyChildPath, typeCheckedValue)
        return error ? prependPathElementToTypeCheckError(error, path, key, typeCheckedValue) : null
      },
      recordCachePruning
    )

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object,

      (obj, path, typeCheckedValue) => {
        if (!isObject(obj)) {
          return new TypeCheckError({
            path,
            expectedTypeName: getTypeName(thisTc),
            actualValue: obj,
            typeCheckedValue,
          })
        }

        if (valueChecker.unchecked) {
          return null
        }

        return checkRecordValues(obj, path, typeCheckedValue)
      },

      getTypeName,
      typeInfoGen,

      (obj) => {
        if (!isObject(obj)) {
          return null
        }

        if (!valueChecker.unchecked) {
          const keys = Object.keys(obj)
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            const v = obj[k]
            const valueActualChecker = valueChecker.snapshotType(v)
            if (!valueActualChecker) {
              return null
            }
          }
        }

        return thisTc
      },

      (obj: Record<string, unknown>) => {
        return applySnapshotProcessor(obj, "from")
      },

      (obj: Record<string, unknown>) => {
        return applySnapshotProcessor(obj, "to")
      }
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.record` type info.
 */
export class RecordTypeInfo extends TypeInfo {
  readonly kind = "record"

  get valueTypeInfo(): TypeInfo {
    return getTypeInfo(this.valueType)
  }

  constructor(
    thisType: AnyStandardType,
    readonly valueType: AnyStandardType
  ) {
    super(thisType)
  }
}
