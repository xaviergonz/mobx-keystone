import { AnyType } from "../typeChecking/schemas"
import { failure } from "../utils"
import { AnyModel, ModelClass } from "./BaseModel"
import { modelValidationTypeCheckerSymbol } from "./modelSymbols"
import { isModel, isModelClass } from "./utils"

/**
 * Returns the associated validation type for runtime checking (if any) to a model instance or
 * class.
 *
 * @param modelClassOrInstance Model class or instance.
 * @returns The associated validation type, or `undefined` if none.
 */
export function getModelValidationType(
  modelClassOrInstance: AnyModel | ModelClass<AnyModel>
): AnyType | undefined {
  if (isModel(modelClassOrInstance)) {
    return (modelClassOrInstance as any).constructor[modelValidationTypeCheckerSymbol]
  } else if (isModelClass(modelClassOrInstance)) {
    return (modelClassOrInstance as any)[modelValidationTypeCheckerSymbol]
  } else {
    throw failure(`modelClassOrInstance must be a model class or instance`)
  }
}
