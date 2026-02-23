import type { O } from "ts-toolbelt"
import { Frozen } from "../../frozen/Frozen"
import type { Path } from "../../parent/pathTypes"
import { assertIsFunction, assertIsObject, isObject, lazy } from "../../utils"
import { withErrorPathSegment } from "../../utils/errorDiagnostics"
import { createPerEntryCachedCheck } from "../createPerEntryCachedCheck"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type {
  AnyStandardType,
  AnyType,
  ModelType,
  ObjectTypeFunction,
  TypeToData,
} from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import {
  LateTypeChecker,
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import { prependPathElementToTypeCheckError } from "../typeCheckErrorUtils"

function typesObjectHelper<S>(objFn: S, frozen: boolean, typeInfoGen: TypeInfoGen): S {
  assertIsFunction(objFn, "objFn")

  return lateTypeChecker(() => {
    const objectSchema: Record<string, TypeChecker | LateTypeChecker> = objFn()
    assertIsObject(objectSchema, "objectSchema")

    type SchemaEntry = Readonly<{
      propName: string
      getResolvedChecker: () => TypeChecker
    }>
    type CheckedSchemaEntry = Readonly<{
      propName: string
      checker: TypeChecker
    }>

    const schemaEntries: ReadonlyArray<SchemaEntry> = Object.entries(objectSchema).map(
      ([propName, unresolvedChecker]) => {
        let resolvedChecker: TypeChecker | undefined
        return {
          propName,
          getResolvedChecker: () => {
            if (!resolvedChecker) {
              resolvedChecker = resolveTypeChecker(unresolvedChecker)
            }
            return resolvedChecker
          },
        }
      }
    )

    const schemaEntryByPropName: Record<string, SchemaEntry> = Object.create(null)
    for (let i = 0; i < schemaEntries.length; i++) {
      const schemaEntry = schemaEntries[i]
      schemaEntryByPropName[schemaEntry.propName] = schemaEntry
    }

    // Precompute the entries we actually need to type-check.
    // This avoids per-check branching for unchecked props and checker re-resolution.
    const checkedSchemaEntries = lazy(() => {
      const checkedEntries: CheckedSchemaEntry[] = []
      for (let i = 0; i < schemaEntries.length; i++) {
        const schemaEntry = schemaEntries[i]
        const checker = schemaEntry.getResolvedChecker()
        if (!checker.unchecked) {
          checkedEntries.push({
            propName: schemaEntry.propName,
            checker,
          })
        }
      }
      return checkedEntries
    })

    const emptyChildPath: Path = []

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const propsMsg: string[] = []
      for (let i = 0; i < schemaEntries.length; i++) {
        const { propName, getResolvedChecker } = schemaEntries[i]
        const tc = getResolvedChecker()
        let propTypename = "..."
        if (!recursiveTypeCheckers.includes(tc)) {
          propTypename = tc.getTypeName(...recursiveTypeCheckers, tc)
        }
        propsMsg.push(`${propName}: ${propTypename};`)
      }

      return `{ ${propsMsg.join(" ")} }`
    }

    const applySnapshotProcessor = (obj: Record<string, unknown>, mode: "from" | "to") => {
      const newObj: typeof obj = {}

      // note: we allow excess properties when checking objects
      const keys = Object.keys(obj)
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        const schemaEntry = schemaEntryByPropName[k]
        if (schemaEntry) {
          const tc = schemaEntry.getResolvedChecker()
          newObj[k] = withErrorPathSegment(k, () =>
            mode === "from" ? tc.fromSnapshotProcessor(obj[k]) : tc.toSnapshotProcessor(obj[k])
          )
        } else {
          // unknown prop, copy as is
          newObj[k] = obj[k]
        }
      }

      return newObj
    }

    const checkObjectType = (obj: any, path: Path, typeCheckedValue: any) => {
      if (!isObject(obj) || (frozen && !(obj instanceof Frozen))) {
        return new TypeCheckError({
          path,
          expectedTypeName: getTypeName(thisTc),
          actualValue: obj,
          typeCheckedValue,
        })
      }

      return null
    }

    // No setupCachePruning needed: iterates fixed schemaEntries, not dynamic object keys,
    // so entries never become stale.
    const checkObjectProps = createPerEntryCachedCheck<number>(
      (_obj, checkEntry) => {
        const entries = checkedSchemaEntries()
        for (let i = 0; i < entries.length; i++) {
          const error = checkEntry(i)
          if (error) return error
        }
        return null
      },
      (obj, entryIndex, path, typeCheckedValue) => {
        const entry = checkedSchemaEntries()[entryIndex]
        if (!entry) {
          return null
        }

        const error = entry.checker.check(obj[entry.propName], emptyChildPath, typeCheckedValue)
        return error
          ? prependPathElementToTypeCheckError(error, path, entry.propName, typeCheckedValue)
          : null
      }
    )

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object,

      (obj, path, typeCheckedValue) => {
        const objectTypeError = checkObjectType(obj, path, typeCheckedValue)
        if (objectTypeError) {
          return objectTypeError
        }

        return checkObjectProps(obj, path, typeCheckedValue)
      },

      getTypeName,
      typeInfoGen,

      (obj) => {
        if (!isObject(obj)) {
          return null
        }

        // note: we allow excess properties when checking objects
        for (let i = 0; i < schemaEntries.length; i++) {
          const schemaEntry = schemaEntries[i]
          const tc = schemaEntry.getResolvedChecker()
          const objVal = obj[schemaEntry.propName]

          const valueActualChecker = tc.snapshotType(objVal)
          if (!valueActualChecker) {
            return null
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
 * A type that represents a plain object.
 * Note that the parameter must be a function that returns an object. This is done so objects can support self / cross types.
 *
 * Example:
 * ```ts
 * // notice the ({ ... }), not just { ... }
 * const pointType = types.object(() => ({
 *   x: types.number,
 *   y: types.number
 * }))
 * ```
 *
 * @template T Type.
 * @param objectFunction Function that generates an object with types.
 * @returns
 */
export function typesObject<T>(objectFunction: T): T {
  // we can't type this function or else we won't be able to make it work recursively
  const typeInfoGen: TypeInfoGen = (t) => new ObjectTypeInfo(t, objectFunction as any)

  return typesObjectHelper(objectFunction, false, typeInfoGen) as any
}

/**
 * `types.object` type info for an object props.
 */
export interface ObjectTypeInfoProps {
  readonly [propName: string]: Readonly<{
    type: AnyStandardType
    typeInfo: TypeInfo
  }>
}

/**
 * `types.object` type info.
 */
export class ObjectTypeInfo extends TypeInfo {
  readonly kind = "object"

  // memoize to always return the same object
  private _props = lazy(() => {
    const objSchema = this._objTypeFn()

    const propTypes: O.Writable<ObjectTypeInfoProps> = {}
    Object.keys(objSchema).forEach((propName) => {
      const type = resolveStandardType(objSchema[propName])
      propTypes[propName] = { type, typeInfo: getTypeInfo(type) }
    })
    return propTypes
  })

  get props(): ObjectTypeInfoProps {
    return this._props()
  }

  constructor(
    thisType: AnyStandardType,
    private _objTypeFn: ObjectTypeFunction
  ) {
    super(thisType)
  }
}

/**
 * A type that represents frozen data.
 *
 * Example:
 * ```ts
 * const frozenNumberType = types.frozen(types.number)
 * const frozenAnyType = types.frozen(types.unchecked<any>())
 * const frozenNumberArrayType = types.frozen(types.array(types.number))
 * const frozenUncheckedNumberArrayType = types.frozen(types.unchecked<number[]>())
 * ```
 *
 * @template T Type.
 * @param dataType Type of the frozen data.
 * @returns
 */
export function typesFrozen<T extends AnyType>(dataType: T): ModelType<Frozen<TypeToData<T>>> {
  return typesObjectHelper(
    () => ({
      data: dataType,
    }),
    true,
    (t) => new FrozenTypeInfo(t, resolveStandardType(dataType))
  ) as any
}

/**
 * `types.frozen` type info.
 */
export class FrozenTypeInfo extends TypeInfo {
  readonly kind = "frozen"

  get dataTypeInfo(): TypeInfo {
    return getTypeInfo(this.dataType)
  }

  constructor(
    thisType: AnyStandardType,
    readonly dataType: AnyStandardType
  ) {
    super(thisType)
  }
}
