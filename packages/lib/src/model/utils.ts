import type { ModelClass } from "../modelShared/BaseModelShared"
import type { SnapshotInOfModel } from "../snapshot/SnapshotOf"
import { failure, isPlainObject } from "../utils"
import type { AnyModel } from "./BaseModel"
import { modelTypeKey } from "./metadata"
import { _BaseModel } from "./_BaseModel"

/**
 * Checks if an object is a model instance.
 *
 * @param model
 * @returns
 */
export function isModel(model: any): model is AnyModel {
  return model instanceof _BaseModel
}

/**
 * @ignore
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
 * @ignore
 * @internal
 */
export function isModelClass(modelClass: any): modelClass is ModelClass<AnyModel> {
  if (typeof modelClass !== "function") {
    return false
  }

  if (modelClass !== _BaseModel && !(modelClass.prototype instanceof _BaseModel)) {
    return false
  }

  return true
}

/**
 * @ignore
 * @internal
 */
export function assertIsModelClass(
  modelClass: unknown,
  argName: string
): asserts modelClass is ModelClass<AnyModel> {
  if (typeof modelClass !== "function") {
    throw failure(`${argName} must be a class`)
  }

  if (modelClass !== _BaseModel && !(modelClass.prototype instanceof _BaseModel)) {
    throw failure(`${argName} must extend Model`)
  }
}

/**
 * @ignore
 * @internal
 */
export function isModelSnapshot(sn: any): sn is SnapshotInOfModel<AnyModel> {
  return isPlainObject(sn) && !!sn[modelTypeKey]
}
