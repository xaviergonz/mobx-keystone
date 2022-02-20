import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "./BaseModelShared"

/**
 * @internal
 */
export interface ModelInfo {
  name: string
  class: ModelClass<AnyModel | AnyDataModel>
}

/**
 * @internal
 */
export const modelInfoByName: {
  [name: string]: ModelInfo
} = {}

/**
 * @internal
 */
export const modelInfoByClass = new Map<ModelClass<AnyModel | AnyDataModel>, ModelInfo>()

/**
 * @internal
 */
export function getModelInfoForName(name: string): ModelInfo | undefined {
  return modelInfoByName[name]
}
