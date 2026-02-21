import { isObject } from "../../utils"
import { withErrorPathSegment } from "../../utils/errorDiagnostics"
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
import { allTypeCheckScope, getChildCheckScope, isTypeCheckScopeAll } from "../typeCheckScope"

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

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object,

      (obj, path, typeCheckedValue, typeCheckScope) => {
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

        const checkValueAtKey = (key: unknown): TypeCheckError | null => {
          if (typeof key !== "string" || !Object.hasOwn(obj, key)) {
            return null
          }

          const childCheckScope = getChildCheckScope(typeCheckScope, key)
          if (childCheckScope === null) {
            return null
          }

          return valueChecker.check(obj[key], [...path, key], typeCheckedValue, childCheckScope)
        }

        if (isTypeCheckScopeAll(typeCheckScope)) {
          const keys = Object.keys(obj)
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            const v = obj[k]
            const valueError = valueChecker.check(
              v,
              [...path, k],
              typeCheckedValue,
              allTypeCheckScope
            )
            if (valueError) {
              return valueError
            }
          }
        } else if (typeCheckScope.pathToChangedObj.length > typeCheckScope.pathOffset) {
          const valueError = checkValueAtKey(
            typeCheckScope.pathToChangedObj[typeCheckScope.pathOffset]
          )
          if (valueError) {
            return valueError
          }
        } else {
          for (const touchedChild of typeCheckScope.touchedChildren) {
            const valueError = checkValueAtKey(touchedChild)
            if (valueError) {
              return valueError
            }
          }
        }

        return null
      },
      undefined,

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
