import { isNonEmptyArray, lateVal } from "../utils"
import { resolveStandardType, resolveTypeChecker } from "./resolveTypeChecker"
import { AnyStandardType, AnyType } from "./schemas"
import { getTypeInfo, lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "./TypeChecker"
import { mergeTypeCheckErrors, TypeCheckErrors } from "./TypeCheckErrors"
import { typesUnchecked } from "./unchecked"

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
export function typesOr<T extends AnyType[]>(...orTypes: T): T[number] {
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

    const thisTc: TypeChecker = new TypeChecker(
      (value, path) => {
        const errors: TypeCheckErrors[] = []
        for (const tc of checkers) {
          const tcErrors = tc.check(value, path)
          if (tcErrors) {
            errors.push(tcErrors)
          } else {
            return null
          }
        }
        return isNonEmptyArray(errors) ? mergeTypeCheckErrors("or", errors) : null
      },
      getTypeName,
      typeInfoGen
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
