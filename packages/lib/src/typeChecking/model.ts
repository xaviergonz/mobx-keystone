import { AnyModel, getModelDataType, ModelClass } from "../model/Model"
import { modelInfoByClass } from "../model/modelInfo"
import { assertIsModelClass } from "../model/utils"
import { failure } from "../utils"
import { IdentityType } from "./schemas"
import { lateTypeChecker, resolveTypeChecker, TypeChecker } from "./TypeChecker"
import { TypeCheckError } from "./TypeCheckError"

const cachedModelTypeChecker = new WeakMap<ModelClass<AnyModel>, TypeChecker>()

/**
 * A type that represents a model. The type referenced in the model decorator will be used for type checking.
 * Use this instead of `types.model` when the model is self-referencing / cross-referencing in typescript.
 *
 * Example:
 * ```ts
 * types.typedModel<SomeModel>(SomeModel)
 * ```
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @returns
 */
export function typesTypedModel<M>(modelClass: any): IdentityType<M> {
  assertIsModelClass(modelClass, "modelClass")

  const cachedTypeChecker = cachedModelTypeChecker.get(modelClass)
  if (cachedTypeChecker) {
    return cachedTypeChecker as any
  }

  const tc = lateTypeChecker(() => {
    const modelInfo = modelInfoByClass.get(modelClass)!
    const typeName = `Model(${modelInfo.name})`

    return new TypeChecker(
      (value, path) => {
        if (!(value instanceof modelClass)) {
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
        if (resolvedTc.check) {
          return resolvedTc.check(value.data, [...path, "data"])
        }

        return null
      },
      () => typeName
    )
  }) as any

  cachedModelTypeChecker.set(modelClass, tc)

  return tc as any
}

/**
 * A type that represents a model. The type referenced in the model decorator will be used for type checking.
 * Use `types.typedModel` instead when the model is self-referencing / cross-referencing in typescript.
 *
 * Example:
 * ```ts
 * types.model(SomeModel)
 * ```
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @returns
 */
export function typesModel<M extends AnyModel>(modelClass: ModelClass<M>) {
  return typesTypedModel<M>(modelClass)
}
