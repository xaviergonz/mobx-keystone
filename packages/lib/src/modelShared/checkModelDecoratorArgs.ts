import { _BaseDataModel } from "../dataModel/_BaseDataModel"
import { _BaseModel } from "../model/_BaseModel"
import { failure } from "../utils"

/**
 * @ignore
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
    target instanceof _BaseModel || target === _BaseModel || target.prototype instanceof _BaseModel
  if (isModel) return

  const isDataModel =
    target instanceof _BaseDataModel ||
    target === _BaseDataModel ||
    target.prototype instanceof _BaseDataModel
  if (isDataModel) return

  throw failure(errMessage)
}
