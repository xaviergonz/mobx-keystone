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
 * Wrap a given type with tag information.
 * This allows you to associate metadata with the type of a prop that
 * you can use at runtime.
 *
 * Example:
 * ```ts
 * const widthType = types.tag(types.number, { displayName: "Width in Inches", required: true }, "dimension")
 * const heightType = types.tag(types.number, { displayName: "Height in Inches", required: true }, "dimension")
 * ```
 *
 * These can then be accessed at runtime through inspection APIs, e.g.
 * ```
 * @model('MyModel')
 * class MyModel extends Model({
 *   width: tProp(widthType, 10),
 *   height: tProp(heightType, 10)
 * }) {}
 *
 * const m = new MyModel({})
 * const type = types.model<typeof Model>(m.constructor)
 * const modelTypeInfo = getTypeInfo(type) as ModelTypeInfo
 * const propTypeInfo = modelTypeInfo.props.width.typeInfo as TagTypeInfo
 * const displayName = propTypeInfo.displayName
 * ```
 * @template T Base type.
 * @param baseType Base type.
 * @template A Tag object.
 * @param tag Abitrary object that can be queried at runtime.
 * @returns
 */
export function typesTag<T extends AnyType, A>(baseType: T, tag: A, typeName?: string): T {
  const resolvedBaseType = resolveStandardType(baseType)
  const typeInfoGen: TypeInfoGen = (t) => new TagTypeInfo(t, resolvedBaseType, tag, typeName)
  const typeChecker = lateTypeChecker(() => {
    const baseChecker = resolveTypeChecker(resolvedBaseType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const baseTypeName = baseChecker.getTypeName(...recursiveTypeCheckers, baseChecker)
      const taggedName = typeName || "tagged"
      return `${taggedName}<${baseTypeName}>`
    }

    const thisTc: TypeChecker = new TypeChecker(
      baseChecker.baseType,
      (data, path, typeCheckedValue) => baseChecker.check(data, path, typeCheckedValue),
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

    return thisTc
  }, typeInfoGen)
  return typeChecker as any
}

/**
 * `types.tag` type info.
 */
export class TagTypeInfo<A> extends TypeInfo {
  readonly kind = "tag"
  readonly baseType: AnyStandardType
  readonly tag: A
  readonly typeName: string | undefined

  get baseTypeInfo(): TypeInfo {
    return getTypeInfo(this.baseType)
  }

  constructor(
    thisType: AnyStandardType,
    baseType: AnyStandardType,
    tag: A,
    typeName: string | undefined
  ) {
    super(thisType)
    this.baseType = baseType
    this.tag = tag
    this.typeName = typeName
  }
}
