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

/**
 * Builds a helpful error message when a model type cannot be resolved from the runtime registry.
 *
 * @param name The model type name (from `$modelType`).
 * @returns A diagnostic message with common remediation steps.
 */
export function getModelNotRegisteredErrorMessage(name: string): string {
  return (
    `model with name "${name}" not found in the registry. ` +
    "This usually means the model module was not imported at runtime " +
    "(for example, due to type-only imports or import elision). " +
    "Import the model module for side effects, use runtime model references " +
    "(for example `tProp(types.model(MyModel))` or `fromSnapshot(MyModel, snapshot)`), " +
    "or call `registerModels(MyModel)` during startup."
  )
}
