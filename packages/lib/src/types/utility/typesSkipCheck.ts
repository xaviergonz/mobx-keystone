import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType } from "../schemas"
import {
  lateTypeChecker,
  snapshotProcessorPlan,
  TypeChecker,
  TypeInfo,
  type TypeInfoGen,
} from "../TypeChecker"

/**
 * A type that wraps another type but skips runtime validation.
 * Unlike `types.unchecked()`, this preserves the wrapped type's
 * runtime/snapshot typing and all processors/codecs/transforms.
 *
 * Use this when you want codec conversions (e.g. `types.dateAsTimestamp`,
 * `types.bigint`, `types.mapFromObject(...)`) without paying the cost of
 * runtime type checking on every change.
 *
 * Example:
 * ```ts
 * // Date codec with no runtime validation
 * const dateType = types.skipCheck(types.dateAsTimestamp)
 *
 * // In a model
 * class M extends Model({ date: tProp(types.skipCheck(types.dateAsTimestamp)) }) {}
 * ```
 *
 * @template T Base type.
 * @param baseType The type whose validation should be skipped.
 * @returns A type with the same runtime/snapshot behavior but no validation.
 */
export function typesSkipCheck<T extends AnyType>(baseType: T): T {
  const resolvedBaseType = resolveStandardType(baseType)
  const typeInfoGen: TypeInfoGen = (t) => new SkipCheckTypeInfo(t, resolvedBaseType)
  const typeChecker = lateTypeChecker(() => {
    const baseChecker = resolveTypeChecker(resolvedBaseType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const baseTypeName = baseChecker.getTypeName(...recursiveTypeCheckers, baseChecker)
      return `skipCheck<${baseTypeName}>`
    }

    const thisTc: TypeChecker = new TypeChecker(
      baseChecker.baseType,
      (_data, _path, _typeCheckedValue) => null, // always passes validation
      getTypeName,
      typeInfoGen,
      (sn) => baseChecker.snapshotType(sn),
      snapshotProcessorPlan(
        () => [baseChecker],
        ([processor]) => processor
      ),
      snapshotProcessorPlan(
        () => [baseChecker],
        ([processor]) => processor
      )
    )
    thisTc.skipCheck = true

    return thisTc
  }, typeInfoGen)
  return typeChecker as any
}

/**
 * `types.skipCheck` type info.
 */
export class SkipCheckTypeInfo extends TypeInfo {
  readonly kind = "skipCheck"
  readonly baseType: AnyStandardType

  get baseTypeInfo(): TypeInfo {
    return getTypeInfo(this.baseType)
  }

  constructor(thisType: AnyStandardType, baseType: AnyStandardType) {
    super(thisType)
    this.baseType = baseType
  }
}
