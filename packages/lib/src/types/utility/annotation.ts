import { getTypeInfo } from "../getTypeInfo"
import { resolveStandardType, resolveTypeChecker } from "../resolveTypeChecker"
import type { AnyStandardType, AnyType } from "../schemas"
import { lateTypeChecker, TypeChecker, TypeInfo, TypeInfoGen } from "../TypeChecker"

/**
 * Wrap a given type with annotation information.
 * This allows you to associate metadata with the type of a prop that
 * you can use at runtime.
 *
 * Example:
 * ```ts
 * const widthType = types.annotation(types.number, { displayName: "Width in Inches", required: true }, "dimension")
 * const heightType = types.annotation(types.number, { displayName: "Height in Inches", required: true }, "dimension")
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
 * const propTypeInfo = modelTypeInfo.props.width.typeInfo as AnnotationTypeInfo
 * const displayName = propTypeInfo.displayName
 * ```
 * @typeparam T Base type.
 * @param baseType Base type.
 * @typeparam A Annotation object.
 * @param annotation Abitrary object that can be queried at runtime.
 * @returns
 */
export function typesAnnotation<T extends AnyType, A>(
  baseType: T,
  annotation: A,
  typeName?: string
): T {
  const typeInfoGen: TypeInfoGen = (t) =>
    new AnnotationTypeInfo(t, resolveStandardType(baseType), annotation, typeName)

  return lateTypeChecker(() => {
    const baseChecker = resolveTypeChecker(baseType)

    const getTypeName = (...recursiveTypeCheckers: TypeChecker[]) => {
      const baseTypeName = baseChecker.getTypeName(...recursiveTypeCheckers, baseChecker)
      const annotatedName = typeName || "annotated"
      return `${annotatedName}<${baseTypeName}>`
    }

    const thisTc: TypeChecker = new TypeChecker(
      baseChecker.baseType,
      baseChecker.check,
      getTypeName,
      typeInfoGen,
      (sn) => baseChecker.snapshotType(sn),
      (sn) => baseChecker.fromSnapshotProcessor(sn),
      (sn) => baseChecker.toSnapshotProcessor(sn)
    )

    return thisTc
  }, typeInfoGen) as any
}

/**
 * `types.annotation` type info.
 */
export class AnnotationTypeInfo<A> extends TypeInfo {
  get baseTypeInfo(): TypeInfo {
    return getTypeInfo(this.baseType)
  }

  constructor(
    thisType: AnyStandardType,
    readonly baseType: AnyStandardType,
    readonly annotation: A,
    readonly typeName: string | undefined
  ) {
    super(thisType)
  }
}
