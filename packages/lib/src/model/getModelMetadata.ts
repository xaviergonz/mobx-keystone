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
  dataType?: AnyType

  /**
   * Property used as model id (usually `$modelId` unless overridden).
   */
  modelIdProperty: string
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

const modelIdPropertyNameCache = new WeakMap<object, string>()

/**
 * @ignore
 * @internal
 */
export function getModelIdPropertyName(modelClass: ModelClass<AnyModel>): string {
  let realKey = modelIdPropertyNameCache.get(modelClass)
  if (!realKey) {
    realKey = getModelMetadata(modelClass).modelIdProperty
    modelIdPropertyNameCache.set(modelClass, realKey)
  }
  return realKey
}
