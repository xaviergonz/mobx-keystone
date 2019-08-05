import { AnyModel, ModelClass } from "../model/BaseModel"
import { getModelDataType } from "../model/getModelDataType"
import { modelInfoByClass } from "../model/modelInfo"
import { assertIsModelClass, isModelClass } from "../model/utils"
import { failure } from "../utils"
import { IdentityType } from "./schemas"
import { lateTypeChecker, resolveTypeChecker, TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

const cachedModelTypeChecker = new WeakMap<ModelClass<AnyModel>, TypeChecker>()

/**
 * A type that represents a model. The type referenced in the model decorator will be used for type checking.
 *
 * Example:
 * ```ts
 * const someModelType = types.model<SomeModel>(SomeModel)
 * // or for recursive models
 * const someModelType = types.model<SomeModel>(() => SomeModel)
 * ```
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @returns
 */
export function typesModel<M = never>(modelClass: object): IdentityType<M> {
  // if we type it any stronger then recursive defs and so on stop working

  if (!isModelClass(modelClass) && typeof modelClass === "function") {
    // resolve later
    return lateTypeChecker(() => typesModel(modelClass()) as any) as any
  }

  const modelClazz: ModelClass<AnyModel> = modelClass as any
  assertIsModelClass(modelClazz, "modelClass")

  const cachedTypeChecker = cachedModelTypeChecker.get(modelClazz)
  if (cachedTypeChecker) {
    return cachedTypeChecker as any
  }

  const tc = lateTypeChecker(() => {
    const modelInfo = modelInfoByClass.get(modelClazz)!
    const typeName = `Model(${modelInfo.name})`

    return new TypeChecker(
      (value, path) => {
        if (!(value instanceof modelClazz)) {
          return new TypeCheckError(path, typeName, value)
        }

        const dataTypeChecker = getModelDataType(value)
        if (!dataTypeChecker) {
          throw failure(
            `type checking cannot be performed over model of type '${
              modelInfo.name
            }' at path ${path.join(
              "/"
            )} since that model type has no data type declared, consider adding a data type or using types.unchecked() instead`
          )
        }

        const resolvedTc = resolveTypeChecker(dataTypeChecker)
        if (!resolvedTc.unchecked) {
          return resolvedTc.check(value.$, [...path, "$"])
        }

        return null
      },
      () => typeName
    )
  }) as any

  cachedModelTypeChecker.set(modelClazz, tc)

  return tc as any
}
