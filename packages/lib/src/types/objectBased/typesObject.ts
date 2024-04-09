import type { O } from "ts-toolbelt"
import { Frozen } from "../../frozen/Frozen"
import { assertIsFunction, assertIsObject, isObject, lazy } from "../../utils"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type {
  AnyStandardType,
  AnyType,
  ModelType,
  ObjectTypeFunction,
  TypeToData,
} from "../schemas"
import {
  lateTypeChecker,
  LateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import { TypeCheckError } from "../TypeCheckError"

function typesObjectHelper<S>(objFn: S, frozen: boolean, typeInfoGen: TypeInfoGen): S {
  assertIsFunction(objFn, "objFn")

  return lateTypeChecker(() => {
    const objectSchema: Record<string, TypeChecker | LateTypeChecker> = objFn()
    assertIsObject(objectSchema, "objectSchema")

    const schemaEntries = Object.entries(objectSchema)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const propsMsg: string[] = []
      for (const [k, unresolvedTc] of schemaEntries) {
        const tc = resolveTypeChecker(unresolvedTc)
        let propTypename = "..."
        if (!recursiveTypeCheckers.includes(tc)) {
          propTypename = tc.getTypeName(...recursiveTypeCheckers, tc)
        }
        propsMsg.push(`${k}: ${propTypename};`)
      }

      return `{ ${propsMsg.join(" ")} }`
    }

    const applySnapshotProcessor = (obj: Record<string, unknown>, mode: "from" | "to") => {
      const newObj: typeof obj = {}

      // note: we allow excess properties when checking objects
      const keys = Object.keys(obj)
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        const unresolvedTc = objectSchema[k]
        if (unresolvedTc) {
          const tc = resolveTypeChecker(unresolvedTc)
          newObj[k] =
            mode === "from" ? tc.fromSnapshotProcessor(obj[k]) : tc.toSnapshotProcessor(obj[k])
        } else {
          // unknown prop, copy as is
          newObj[k] = obj[k]
        }
      }

      return newObj
    }

    const thisTc: TypeChecker = new TypeChecker(
      TypeCheckerBaseType.Object,

      (obj, path, typeCheckedValue) => {
        if (!isObject(obj) || (frozen && !(obj instanceof Frozen))) {
          return new TypeCheckError(path, getTypeName(thisTc), obj, typeCheckedValue)
        }

        // note: we allow excess properties when checking objects
        for (const [k, unresolvedTc] of schemaEntries) {
          const tc = resolveTypeChecker(unresolvedTc)
          const objVal = obj[k]

          const valueError = tc.check(objVal, [...path, k], typeCheckedValue)
          if (valueError) {
            return valueError
          }
        }

        return null
      },

      getTypeName,
      typeInfoGen,

      (obj) => {
        if (!isObject(obj)) {
          return null
        }

        // note: we allow excess properties when checking objects
        for (const [k, unresolvedTc] of schemaEntries) {
          const tc = resolveTypeChecker(unresolvedTc)
          const objVal = obj[k]

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
 * @typeparam T Type.
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
 * @typeparam T Type.
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
