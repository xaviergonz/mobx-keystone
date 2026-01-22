import type { AnyDataModel } from "../dataModel/BaseDataModel"
import { isDataModel } from "../dataModel/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName, ModelInfo } from "../modelShared/modelInfo"
import { failure, isPlainObject } from "../utils"
import { AnyModel, BaseModel } from "./BaseModel"
import { getModelIdPropertyName } from "./getModelMetadata"
import { modelIdKey, modelTypeKey } from "./metadata"

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
    const modelType = (snapshot as any)[modelTypeKey]
    return typeof modelType === "string" ? modelType : undefined
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
  return getSnapshotModelTypeAndId(snapshot)?.modelId
}

/**
 * Model type and ID information.
 */
export interface ModelTypeAndId {
  /**
   * The model type name (from `$modelType`).
   */
  modelType: string

  /**
   * The model ID value, or `undefined` if the model has no ID property.
   */
  modelId: string | undefined

  /**
   * The name of the property that holds the model ID (as declared with `idProp`),
   * or `undefined` if the model has no ID property.
   */
  modelIdPropertyName: string | undefined

  /**
   * The model info (contains the model class and name).
   */
  modelInfo: ModelInfo
}

/**
 * Gets the model type and ID from a model snapshot.
 *
 * The result includes:
 * - `modelType`: The model type name (from `$modelType`)
 * - `modelId`: The model ID value (or `undefined` if no ID property)
 * - `modelIdPropertyName`: The name of the property that holds the model ID (or `undefined` if no ID property)
 * - `modelInfo`: The model info (contains the model class and name)
 *
 * @param snapshot - A model snapshot (must have `$modelType`).
 * @returns The model type and ID info, or `undefined` if not a valid model snapshot.
 */
export function getSnapshotModelTypeAndId(snapshot: unknown): ModelTypeAndId | undefined {
  const modelType = getSnapshotModelType(snapshot)
  if (modelType === undefined) {
    return undefined
  }

  const modelInfo = getModelInfoForName(modelType)
  if (!modelInfo) {
    return undefined
  }

  const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)

  let modelId: string | undefined
  if (modelIdPropertyName) {
    const id = (snapshot as Record<string, unknown>)[modelIdPropertyName]
    modelId = typeof id === "string" ? id : undefined
  }

  return { modelType, modelId, modelIdPropertyName, modelInfo }
}

/**
 * Gets the model type and ID from a Model or DataModel instance.
 *
 * The result includes:
 * - `modelType`: The model type name (from `$modelType`)
 * - `modelId`: The model ID value (or `undefined` if no ID property)
 * - `modelIdPropertyName`: The name of the property that holds the model ID (or `undefined` if no ID property)
 * - `modelInfo`: The model info (contains the model class and name)
 *
 * @param model - A Model or DataModel instance.
 * @returns The model type and ID info, or `undefined` if not a valid model.
 */
export function getModelTypeAndId(model: AnyModel | AnyDataModel): ModelTypeAndId | undefined {
  // Handle null/undefined
  if (!model || typeof model !== "object") {
    return undefined
  }

  const modelType = (model as any)[modelTypeKey] as string | undefined
  if (typeof modelType !== "string") {
    return undefined
  }

  const modelInfo = getModelInfoForName(modelType)
  if (!modelInfo) {
    return undefined
  }

  const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)

  let modelId: string | undefined
  if (modelIdPropertyName) {
    const id = (model as any)[modelIdKey] as string | undefined
    modelId = typeof id === "string" ? id : undefined
  }

  return { modelType, modelId, modelIdPropertyName, modelInfo }
}

/**
 * Gets the model type and ID from a Model instance, DataModel instance, or model snapshot.
 *
 * The result includes:
 * - `modelType`: The model type name (from `$modelType`)
 * - `modelId`: The model ID value (or `undefined` if no ID property)
 * - `modelIdPropertyName`: The name of the property that holds the model ID (or `undefined` if no ID property)
 * - `modelInfo`: The model info (contains the model class and name)
 *
 * @param value - A Model instance, DataModel instance, or model snapshot.
 * @returns The model type and ID info, or `undefined` if not a valid model or snapshot.
 */
export function getModelOrSnapshotTypeAndId(value: unknown): ModelTypeAndId | undefined {
  // Handle null/undefined/primitives
  if (!value || typeof value !== "object") {
    return undefined
  }

  if (isModel(value) || isDataModel(value)) {
    return getModelTypeAndId(value)
  }

  // Try as snapshot
  return getSnapshotModelTypeAndId(value)
}
