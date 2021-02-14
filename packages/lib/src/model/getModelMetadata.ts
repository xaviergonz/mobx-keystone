import { AnyType } from "../typeChecking/schemas"
import { failure } from "../utils"
import { AnyModel, ModelClass } from "./BaseModel"
import { modelMetadataSymbol } from "./modelSymbols"
import { isModel, isModelClass } from "./utils"

/**
 * Associated model metadata.
 */
export interface ModelMetadata {
  /**
   * Associated data type for runtime checking (if any).
   */
  dataType?: AnyType;
}

/**
 * Returns the associated metadata for a model instance or class.
 *
 * @param modelClassOrInstance Model class or instance.
 * @returns The associated metadata.
 */
export function getModelMetadata(
  modelClassOrInstance: AnyModel | ModelClass<AnyModel>
): ModelMetadata {
  if (isModel(modelClassOrInstance)) {
    return (modelClassOrInstance as any).constructor[modelMetadataSymbol]
  } else if (isModelClass(modelClassOrInstance)) {
    return (modelClassOrInstance as any)[modelMetadataSymbol]
  } else {
    throw failure(`modelClassOrInstance must be a model class or instance`)
  }
}
