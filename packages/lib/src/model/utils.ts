import type { ModelClass } from "../modelShared/BaseModelShared"
import { failure, isPlainObject } from "../utils"
import { AnyModel, BaseModel } from "./BaseModel"
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
 * @internal
 */
export function isModelSnapshot(sn: unknown): sn is { [modelTypeKey]: string } {
  return isPlainObject(sn) && modelTypeKey in sn
}
