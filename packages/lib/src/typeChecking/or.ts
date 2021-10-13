import { failure, lateVal } from "../utils"
import { getTypeInfo } from "./getTypeInfo"
import {
  resolveStandardType,
  resolveStandardTypeNoThrow,
  resolveTypeChecker,
} from "./resolveTypeChecker"
import type { AnyStandardType, AnyType } from "./schemas"
import {
  getTypeCheckerBaseTypeFromValue,
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"
import { typesUnchecked } from "./unchecked"

/**
 * A type that represents the union of several other types (a | b | c | ...).
 * Accepts a dispatcher that, given a snapshot, returns the type
 * that snapshot is.
 *
 * @typeparam T Type.
 * @param dispatcher Function that given a snapshot returns the type.
 * @param orTypes Possible types.
 * @returns
 */
export function typesOr<T extends AnyType[]>(
  dispatcher: (sn: any) => T[number],
  ...orTypes: T
): T[number]

/**
 * A type that represents the union of several other types (a | b | c | ...).
 *
 * Example:
 * ```ts
 * const booleanOrNumberType = types.or(types.boolean, types.number)
 * ```
 *
 * @typeparam T Type.
 * @param orTypes Possible types.
 * @returns
 */
export function typesOr<T extends AnyType[]>(...orTypes: T): T[number]

export function typesOr(
  dispatcherOrType: ((sn: any) => AnyType) | AnyType,
  ...moreOrTypes: AnyType[]
): AnyType {
  const orTypes = moreOrTypes.slice()
  let finalDispatcher: ((sn: any) => TypeChecker) | undefined

  const firstTypeChecker = resolveStandardTypeNoThrow(dispatcherOrType as AnyType)

  if (firstTypeChecker) {
    orTypes.unshift(firstTypeChecker)
  } else {
    const dispatcher = dispatcherOrType as (sn: any) => AnyType
    finalDispatcher = (sn: any) => {
      const type = dispatcher(sn)
      const typeChecker = resolveTypeChecker(type)
      return typeChecker
    }
  }

  if (orTypes.length <= 0) {
    throw failure("or type must have at least 1 possible type")
  }

  const typeInfoGen: TypeInfoGen = (t) => new OrTypeInfo(t, orTypes.map(resolveStandardType))

  return lateTypeChecker(() => {
    const checkers = orTypes.map(resolveTypeChecker)

    // if the or includes unchecked then it is unchecked
    if (checkers.some((tc) => tc.unchecked)) {
      return typesUnchecked() as any
    }

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const typeNames = checkers.map((tc) => {
        if (recursiveTypeCheckers.includes(tc)) {
          return "..."
        }
        return tc.getTypeName(...recursiveTypeCheckers, tc)
      })

      return typeNames.join(" | ")
    }

    let thisTcBaseType: TypeCheckerBaseType
    if (checkers.some((c) => c.baseType !== checkers[0].baseType)) {
      thisTcBaseType = TypeCheckerBaseType.Any
    } else {
      thisTcBaseType = checkers[0].baseType
    }

    const thisTc: TypeChecker = new TypeChecker(
      thisTcBaseType,

      (value, path) => {
        const someMatchingType = checkers.some((tc) => !tc.check(value, path))
        if (someMatchingType) {
          return null
        } else {
          return new TypeCheckError(path, getTypeName(thisTc), value)
        }
      },

      getTypeName,
      typeInfoGen,

      (value) => {
        const valueBaseType = getTypeCheckerBaseTypeFromValue(value)

        const checkerForBaseType = checkers.filter(
          (c) => c.baseType === valueBaseType || c.baseType === TypeCheckerBaseType.Any
        )

        if (checkerForBaseType.length === 1 && checkerForBaseType[0].baseType === valueBaseType) {
          // when there is only one valid option accept it without asking
          // this is done because:
          // 1) performance (avoid checking structure if not needed)
          // 2) so we can accept untyped models when paired with undefined | null
          return checkerForBaseType[0]
        }

        for (let i = 0; i < checkerForBaseType.length; i++) {
          const matchingType = checkerForBaseType[i].snapshotType(value)
          if (matchingType) {
            return matchingType
          }
        }

        return null
      },

      (sn) => {
        const type = finalDispatcher ? finalDispatcher(sn) : thisTc.snapshotType(sn)
        if (!type) {
          throw failure(
            `snapshot '${JSON.stringify(sn)}' does not match the following type: ${getTypeName(
              thisTc
            )}`
          )
        }

        return type.fromSnapshotProcessor(sn)
      },

      (sn) => {
        const type = finalDispatcher ? finalDispatcher(sn) : thisTc.snapshotType(sn)
        if (!type) {
          throw failure(
            `snapshot '${JSON.stringify(sn)}' does not match the following type: ${getTypeName(
              thisTc
            )}`
          )
        }

        return type.toSnapshotProcessor(sn)
      }
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.or` type info.
 */
export class OrTypeInfo extends TypeInfo {
  // memoize to always return the same array on the getter
  private _orTypeInfos = lateVal(() => this.orTypes.map(getTypeInfo))

  get orTypeInfos(): ReadonlyArray<TypeInfo> {
    return this._orTypeInfos()
  }

  constructor(thisType: AnyStandardType, readonly orTypes: ReadonlyArray<AnyStandardType>) {
    super(thisType)
  }
}
