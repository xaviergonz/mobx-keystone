import type { ModelClass } from "../modelShared/BaseModelShared"
import { failure } from "../utils"
import type { AnyDataModel } from "./BaseDataModel"
import { BaseDataModel } from "./BaseDataModel"

/**
 * Checks if an object is a data model instance.
 *
 * @param model
 * @returns
 */
export function isDataModel(model: unknown): model is AnyDataModel {
  return model instanceof BaseDataModel
}

/**
 * @internal
 */
export function isDataModelClass(modelClass: unknown): modelClass is ModelClass<AnyDataModel> {
  return (
    typeof modelClass === "function" &&
    (modelClass === BaseDataModel || modelClass.prototype instanceof BaseDataModel)
  )
}

/**
 * @internal
 */
export function assertIsDataModelClass(
  modelClass: unknown,
  argName: string
): asserts modelClass is ModelClass<AnyDataModel> {
  if (typeof modelClass !== "function") {
    throw failure(`${argName} must be a class`)
  }

  if (!isDataModelClass(modelClass)) {
    throw failure(`${argName} must extend DataModel`)
  }
}
