import { BaseDataModel } from "../dataModel/BaseDataModel"
import { BaseModel } from "../model/BaseModel"
import { failure } from "../utils"

/**
 * @internal
 */
export function checkModelDecoratorArgs(fnName: string, target: any, propertyKey: string) {
  if (typeof propertyKey !== "string") {
    throw failure(`${fnName} cannot be used over symbol properties`)
  }

  const errMessage = `${fnName} must be used over model classes or instances`

  if (!target) {
    throw failure(errMessage)
  }

  // check target is a model object or extended class
  const isModel =
    target instanceof BaseModel || target === BaseModel || target.prototype instanceof BaseModel
  if (isModel) return

  const isDataModel =
    target instanceof BaseDataModel ||
    target === BaseDataModel ||
    target.prototype instanceof BaseDataModel
  if (isDataModel) return

  throw failure(errMessage)
}
