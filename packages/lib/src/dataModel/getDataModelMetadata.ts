import type { ModelClass } from "../modelShared/BaseModelShared"
import { modelMetadataSymbol } from "../modelShared/modelSymbols"
import type { AnyType } from "../typeChecking/schemas"
import { failure } from "../utils"
import type { AnyDataModel } from "./BaseDataModel"
import { isDataModel, isDataModelClass } from "./utils"

/**
 * Associated data model metadata.
 */
export interface DataModelMetadata {
  /**
   * Associated data type for runtime checking (if any).
   */
  dataType?: AnyType
}

/**
 * Returns the associated metadata for a data model instance or class.
 *
 * @param modelClassOrInstance Data model class or instance.
 * @returns The associated metadata.
 */
export function getDataModelMetadata(
  modelClassOrInstance: AnyDataModel | ModelClass<AnyDataModel>
): DataModelMetadata {
  if (isDataModel(modelClassOrInstance)) {
    return (modelClassOrInstance as any).constructor[modelMetadataSymbol]
  } else if (isDataModelClass(modelClassOrInstance)) {
    return (modelClassOrInstance as any)[modelMetadataSymbol]
  } else {
    throw failure(`modelClassOrInstance must be a model class or instance`)
  }
}
