import { AnyType } from "../typeChecking/schemas"
import { failure } from "../utils"
import { AnyModel, ModelClass } from "./Model"
import { getModelInfoForObject, modelInfoByClass } from "./modelInfo"
import { isModel, isModelClass } from "./utils"

/**
 * Returns the associated data type for run-time checking (if any) to a model instance or class.
 *
 * @param modelClassOrInstance Model class or instance.
 * @returns The associated data type, or undefined if none.
 */
export function getModelDataType(
  modelClassOrInstance: AnyModel | ModelClass<AnyModel>
): AnyType | undefined {
  if (isModel(modelClassOrInstance)) {
    return getModelInfoForObject(modelClassOrInstance)!.dataTypeChecker as any
  } else if (isModelClass(modelClassOrInstance)) {
    return modelInfoByClass.get(modelClassOrInstance)!.dataTypeChecker as any
  } else {
    throw failure(`modelClassOrInstance must be a model class or instance`)
  }
}
