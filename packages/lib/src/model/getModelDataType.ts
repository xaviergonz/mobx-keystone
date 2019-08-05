import { AnyType } from "../typeChecking/schemas"
import { failure } from "../utils"
import { AnyModel, ModelClass } from "./BaseModel"
import { modelDataTypeCheckerSymbol } from "./modelSymbols"
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
  if (isModel(modelClassOrInstance) || isModelClass(modelClassOrInstance)) {
    return (modelClassOrInstance as any)[modelDataTypeCheckerSymbol]
  } else {
    throw failure(`modelClassOrInstance must be a model class or instance`)
  }
}
