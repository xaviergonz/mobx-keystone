import { SnapshotInOfModel } from "../snapshot/SnapshotOf"
import { failure, isPlainObject } from "../utils"
import { modelMetadataKey } from "./metadata"
import { AnyModel, BaseModel, ModelClass } from "./Model"

/**
 * Checks if an object is a model instance.
 *
 * @param model
 * @returns
 */
export function isModel(model: any): model is AnyModel {
  return model instanceof BaseModel
}

/**
 * @ignore
 *
 * Asserts something is actually a model.
 *
 * @param model
 * @param argName
 */
export function assertIsModel(
  model: AnyModel,
  argName: string,
  customErrMsg = "must be a model instance"
) {
  if (!isModel(model)) {
    throw failure(`${argName} ${customErrMsg}`)
  }
}

/**
 * @ignore
 */
export function isModelClass(modelClass: any): modelClass is ModelClass<AnyModel> {
  if (typeof modelClass !== "function") {
    return false
  }

  if (modelClass !== BaseModel && !(modelClass.prototype instanceof BaseModel)) {
    return false
  }

  return true
}

/**
 * @ignore
 */
export function assertIsModelClass(modelClass: ModelClass<AnyModel>, argName: string): void {
  if (typeof modelClass !== "function") {
    throw failure(`${argName} must be a class`)
  }

  if (modelClass !== BaseModel && !(modelClass.prototype instanceof BaseModel)) {
    throw failure(`${argName} must extend Model`)
  }
}

/**
 * @ignore
 */
export function isModelSnapshot(sn: any): sn is SnapshotInOfModel<AnyModel> {
  return isPlainObject(sn) && !!sn[modelMetadataKey]
}

/**
 * @ignore
 */
export function checkModelDecoratorArgs(fnName: string, target: any, propertyKey: string) {
  if (typeof propertyKey !== "string") {
    throw failure(fnName + " cannot be used over symbol properties")
  }

  const errMessage = fnName + " must be used over model classes or instances"

  if (!target) {
    throw failure(errMessage)
  }

  // check target is a model object or extended class
  if (
    !(target instanceof BaseModel) &&
    target !== BaseModel &&
    !(target.prototype instanceof BaseModel)
  ) {
    throw failure(errMessage)
  }
}
