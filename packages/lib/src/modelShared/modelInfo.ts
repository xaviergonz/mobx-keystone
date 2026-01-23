import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "./BaseModelShared"

/**
 * Information about a registered model.
 */
export interface ModelInfo {
  name: string
  class: ModelClass<AnyModel | AnyDataModel>
}

/**
 * @internal
 */
export const modelInfoByName: {
  [name: string]: ModelInfo
} = {}

/**
 * @internal
 */
export const modelInfoByClass = new WeakMap<ModelClass<AnyModel | AnyDataModel>, ModelInfo>()

/**
 * Returns the model info for a model type name, or `undefined` if not found.
 *
 * @param name The model type name (from `$modelType`).
 * @returns The model info or `undefined`.
 */
export function getModelInfoForName(name: string): ModelInfo | undefined {
  return modelInfoByName[name]
}
