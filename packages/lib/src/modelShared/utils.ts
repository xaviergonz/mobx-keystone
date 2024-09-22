import type { AnyDataModel } from "../dataModel/BaseDataModel"
import { isDataModelClass } from "../dataModel/utils"
import type { AnyModel } from "../model/BaseModel"
import { isModelClass } from "../model/utils"
import { failure } from "../utils"
import type { ModelClass } from "./BaseModelShared"

/**
 * @internal
 *
 * Asserts something is actually a class or data model.
 *
 * @param model
 * @param argName
 */
export function assertIsClassOrDataModelClass(
  model: unknown,
  argName: string,
  customErrMsg = "must be a class or data model class"
): asserts model is ModelClass<AnyModel> | ModelClass<AnyDataModel> {
  if (!(isModelClass(model) || isDataModelClass(model))) {
    throw failure(`${argName} ${customErrMsg}`)
  }
}
