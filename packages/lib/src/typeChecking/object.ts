import { Frozen } from "../frozen/Frozen"
import { assertIsFunction, assertIsObject, isObject } from "../utils"
import { AnyType, ObjectType } from "./schemas"
import { lateTypeChecker, LateTypeChecker, resolveTypeChecker, TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

function typesObjectHelper<S>(objFn: S, frozen: boolean): S {
  assertIsFunction(objFn, "objFn")

  return lateTypeChecker(() => {
    const objectSchema: {
      [k: string]: TypeChecker | LateTypeChecker
    } = (objFn as any)()
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

    const thisTc: TypeChecker = new TypeChecker((obj, path) => {
      if (!isObject(obj) || (frozen && !(obj instanceof Frozen)))
        return new TypeCheckError(path, getTypeName(thisTc), obj)

      const keysToCheck = new Set(Object.keys(obj))
      for (const [k, unresolvedTc] of schemaEntries) {
        const tc = resolveTypeChecker(unresolvedTc)
        const objVal = obj[k]

        const valueError = !tc.unchecked ? tc.check(objVal, [...path, k]) : null
        if (valueError) {
          return valueError
        }

        keysToCheck.delete(k)
      }

      if (keysToCheck.size > 0) {
        return new TypeCheckError(path, getTypeName(thisTc), obj)
      }

      return null
    }, getTypeName)

    return thisTc
  }) as any
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
  return typesObjectHelper(objectFunction, false)
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
 * @typeParam T Type.
 * @param dataType Type of the frozen data.
 * @returns
 */
export function typesFrozen<T extends AnyType>(dataType: T): ObjectType<{ $: T }> {
  return typesObjectHelper(
    () => ({
      $: dataType,
    }),
    true
  ) as any
}
