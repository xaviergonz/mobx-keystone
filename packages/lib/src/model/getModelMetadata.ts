import type { ModelClass } from "../modelShared/BaseModelShared"
import { modelMetadataSymbol } from "../modelShared/modelSymbols"
import type { AnyType } from "../typeChecking/schemas"
import { failure } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import type { AnyModel } from "./BaseModel"
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
   * Property used as model id.
   */
  modelIdProperty: string | undefined

  /**
   * A value type will be cloned automatically when being attached to a new tree.
   */
  valueType: boolean
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

const modelIdPropertyNameCache = new WeakMap<object, string | undefined>()

/**
 * @ignore
 * @internal
 */
export function getModelIdPropertyName(modelClass: ModelClass<AnyModel>): string | undefined {
  return getOrCreate(
    modelIdPropertyNameCache,
    modelClass,
    () => getModelMetadata(modelClass).modelIdProperty
  )
}
