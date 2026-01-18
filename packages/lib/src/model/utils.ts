import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { failure, isPlainObject } from "../utils"
import { AnyModel, BaseModel } from "./BaseModel"
import { getModelIdPropertyName } from "./getModelMetadata"
import { modelTypeKey } from "./metadata"

/**
 * Checks if an object is a model instance.
 *
 * @param model
 * @returns
 */
export function isModel(model: unknown): model is AnyModel {
  return model instanceof BaseModel
}

/**
 * @internal
 *
 * Asserts something is actually a model.
 *
 * @param model
 * @param argName
 */
export function assertIsModel(
  model: unknown,
  argName: string,
  customErrMsg = "must be a model instance"
): asserts model is AnyModel {
  if (!isModel(model)) {
    throw failure(`${argName} ${customErrMsg}`)
  }
}

/**
 * @internal
 */
export function isModelClass(modelClass: unknown): modelClass is ModelClass<AnyModel> {
  if (typeof modelClass !== "function") {
    return false
  }

  if (modelClass !== BaseModel && !(modelClass.prototype instanceof BaseModel)) {
    return false
  }

  return true
}

/**
 * @internal
 */
export function assertIsModelClass(
  modelClass: unknown,
  argName: string
): asserts modelClass is ModelClass<AnyModel> {
  if (typeof modelClass !== "function") {
    throw failure(`${argName} must be a class`)
  }

  if (modelClass !== BaseModel && !(modelClass.prototype instanceof BaseModel)) {
    throw failure(`${argName} must extend Model`)
  }
}

/**
 * Gets the model type name from a model snapshot.
 *
 * @param snapshot - The snapshot to get the model type from.
 * @returns The model type name if the snapshot is a model snapshot, `undefined` otherwise.
 */
export function getSnapshotModelType(snapshot: unknown): string | undefined {
  if (isPlainObject(snapshot) && modelTypeKey in snapshot) {
    return (snapshot as { [modelTypeKey]: string })[modelTypeKey]
  }
  return undefined
}

/**
 * Gets the model ID from a model snapshot.
 *
 * This function extracts the model's unique identifier from a snapshot
 * by looking up the model class using `$modelType` and then reading
 * the value of the ID property (as declared with `idProp`).
 *
 * @param snapshot - A model snapshot (must have `$modelType`).
 * @returns The model ID if the snapshot has an ID property, or `undefined` if not.
 */
export function getSnapshotModelId(snapshot: unknown): string | undefined {
  const modelType = getSnapshotModelType(snapshot)
  if (modelType === undefined) {
    return undefined
  }

  const modelInfo = getModelInfoForName(modelType)
  if (!modelInfo) {
    return undefined
  }

  const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)
  if (!modelIdPropertyName) {
    return undefined
  }

  const id = (snapshot as Record<string, unknown>)[modelIdPropertyName]
  return typeof id === "string" ? id : undefined
}
