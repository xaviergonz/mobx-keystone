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
 * @ignore
 * @internal
 */
export function getDataModelAction(fullActionName: string) {
  return dataModelActionRegistry.get(fullActionName)
}

/**
 * @ignore
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
