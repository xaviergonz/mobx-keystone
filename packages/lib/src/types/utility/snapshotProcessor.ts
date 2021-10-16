import type { SnapshotInOf, SnapshotOutOf } from "../../snapshot/SnapshotOf"
import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType, SnapshotProcessorType, TypeToData } from "../schemas"
import { lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "../TypeChecker"

/**
 * A type that processes in/out snapshots before feeding the data to another types.
 *
 * Example:
 * ```ts
 * const numberAsStringType = types.snapshotProcessor(
 *   types.number,
 *   {
 *     fromSnapshot(sn: string) {
 *       return Number(sn);
 *     },
 *     toSnapshot(sn): string {
 *       return String(sn);
 *     }
 *   },
 *   "numberAsString"
 * )
 * ```
 *
 * @template T Base type.
 * @param baseType Base type.
 * @param processors Snapshot processors to apply.
 * @returns
 */
export function typesSnapshotProcessor<
  T extends AnyType,
  TFromSnapshotOverride = never,
  TToSnapshotOverride = never
>(
  baseType: T,
  processors: {
    fromSnapshot?(sn: TFromSnapshotOverride): SnapshotInOf<TypeToData<T>>
    toSnapshot?(sn: SnapshotOutOf<TypeToData<T>>): TToSnapshotOverride
  },
  typeName?: string
): SnapshotProcessorType<T, TFromSnapshotOverride, TToSnapshotOverride> {
  const typeInfoGen: TypeInfoGen = (t) =>
    new SnapshotProcessorTypeInfo(t, resolveStandardType(baseType), processors, typeName)

  return lateTypeChecker(() => {
    const baseChecker = resolveTypeChecker(baseType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const baseTypeName = baseChecker.getTypeName(...recursiveTypeCheckers, baseChecker)
      const name = typeName || "snapshotProcessorFor"
      return `${name}<${baseTypeName}>`
    }

    const thisTc: TypeChecker = new TypeChecker(
      baseChecker.baseType,

      (data, path) => {
        return baseChecker.check(data, path)
      },

      getTypeName,
      typeInfoGen,

      (sn) => {
        if (processors.fromSnapshot) {
          // if applying the fromSnapshot fails then this snapshot is not of the base type
          // for sure
          try {
            sn = processors.fromSnapshot(sn as any)
          } catch {
            return null
          }
        }

        return baseChecker.snapshotType(sn)
      },

      (sn) => {
        if (processors.fromSnapshot) {
          sn = processors.fromSnapshot(sn)
        }
        sn = baseChecker.fromSnapshotProcessor(sn)
        return sn
      },

      (sn) => {
        sn = baseChecker.toSnapshotProcessor(sn)
        if (processors.toSnapshot) {
          sn = processors.toSnapshot(sn)
        }
        return sn
      }
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.snapshotProcessor` type info.
 */
export class SnapshotProcessorTypeInfo extends TypeInfo {
  get baseTypeInfo(): TypeInfo {
    return getTypeInfo(this.baseType)
  }

  constructor(
    thisType: AnyStandardType,
    readonly baseType: AnyStandardType,
    readonly processors: {
      fromSnapshot?(sn: any): any
      toSnapshot?(sn: any): any
    },
    readonly typeName: string | undefined
  ) {
    super(thisType)
  }
}
