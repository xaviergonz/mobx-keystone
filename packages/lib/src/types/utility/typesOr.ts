import { failure, lazy } from "../../utils"
import { getTypeInfo } from "../getTypeInfo"
import {
  resolveStandardType,
  resolveStandardTypeNoThrow,
  resolveTypeChecker,
} from "../resolveTypeChecker"
import { SnapshotTypeMismatchError } from "../SnapshotTypeMismatchError"
import type { AnyStandardType, AnyType } from "../schemas"
import { TypeCheckError } from "../TypeCheckError"
import {
  getTypeCheckerBaseTypeFromValue,
  lateTypeChecker,
  TypeChecker,
  TypeCheckerBaseType,
  TypeInfo,
  TypeInfoGen,
} from "../TypeChecker"
import { typesUnchecked } from "./typesUnchecked"

/**
 * A type that represents the union of several other types (a | b | c | ...).
 * Accepts a dispatcher that, given a snapshot, returns the type
 * that snapshot is.
 *
 * @template T Type.
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
 * @template T Type.
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

    const anyCheckers: TypeChecker[] = []
    const primitiveOrAnyCheckers: TypeChecker[] = []
    const objectOrAnyCheckers: TypeChecker[] = []
    const arrayOrAnyCheckers: TypeChecker[] = []

    for (let i = 0; i < checkers.length; i++) {
      const checker = checkers[i]
      switch (checker.baseType) {
        case TypeCheckerBaseType.Primitive:
          primitiveOrAnyCheckers.push(checker)
          break
        case TypeCheckerBaseType.Object:
          objectOrAnyCheckers.push(checker)
          break
        case TypeCheckerBaseType.Array:
          arrayOrAnyCheckers.push(checker)
          break
        case TypeCheckerBaseType.Any:
          anyCheckers.push(checker)
          primitiveOrAnyCheckers.push(checker)
          objectOrAnyCheckers.push(checker)
          arrayOrAnyCheckers.push(checker)
          break
        default:
          break
      }
    }

    const getCandidateCheckers = (
      valueBaseType: TypeCheckerBaseType
    ): ReadonlyArray<TypeChecker> => {
      switch (valueBaseType) {
        case TypeCheckerBaseType.Primitive:
          return primitiveOrAnyCheckers
        case TypeCheckerBaseType.Object:
          return objectOrAnyCheckers
        case TypeCheckerBaseType.Array:
          return arrayOrAnyCheckers
        case TypeCheckerBaseType.Any:
          return anyCheckers
        default:
          return anyCheckers
      }
    }

    const thisTc: TypeChecker = new TypeChecker(
      thisTcBaseType,

      (value, path, typeCheckedValue) => {
        // Union types must always full-check every alternative. Partial checking could
        // produce false positives when overlapping alternatives each pass on different
        // property subsets without any single alternative passing in full.
        const valueBaseType = getTypeCheckerBaseTypeFromValue(value)
        const candidateCheckers = getCandidateCheckers(valueBaseType)

        for (let i = 0; i < candidateCheckers.length; i++) {
          const tc = candidateCheckers[i]
          if (!tc.check(value, path, typeCheckedValue)) {
            return null
          }
        }

        return new TypeCheckError({
          path,
          expectedTypeName: getTypeName(thisTc),
          actualValue: value,
          typeCheckedValue,
        })
      },

      getTypeName,
      typeInfoGen,

      (value) => {
        const valueBaseType = getTypeCheckerBaseTypeFromValue(value)
        const checkerForBaseType = getCandidateCheckers(valueBaseType)

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
          throw new SnapshotTypeMismatchError({
            expectedTypeName: getTypeName(thisTc),
            actualValue: sn,
          })
        }

        return type.fromSnapshotProcessor(sn)
      },

      (sn) => {
        const type = finalDispatcher ? finalDispatcher(sn) : thisTc.snapshotType(sn)
        if (!type) {
          throw new SnapshotTypeMismatchError({
            expectedTypeName: getTypeName(thisTc),
            actualValue: sn,
          })
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
  readonly kind = "or"

  // memoize to always return the same array on the getter
  private _orTypeInfos = lazy(() => this.orTypes.map(getTypeInfo))

  get orTypeInfos(): ReadonlyArray<TypeInfo> {
    return this._orTypeInfos()
  }

  constructor(
    thisType: AnyStandardType,
    readonly orTypes: ReadonlyArray<AnyStandardType>
  ) {
    super(thisType)
  }
}
