import { ModelClass } from "../modelShared/BaseModelShared"
import type { AnyDataModel } from "./BaseDataModel"

const dataModelActionRegistry = new Map<
  string,
  {
    modelClass: ModelClass<AnyDataModel>
    fnName: string
  }
>()

/**
 * @internal
 */
export function getDataModelAction(fullActionName: string) {
  return dataModelActionRegistry.get(fullActionName)
}

/**
 * @internal
 */
export function setDataModelAction(
  fullActionName: string,
  modelClass: ModelClass<AnyDataModel>,
  fnName: string
) {
  dataModelActionRegistry.set(fullActionName, {
    modelClass,
    fnName,
  })
}
