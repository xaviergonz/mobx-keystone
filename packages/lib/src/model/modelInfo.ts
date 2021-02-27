import { isObject } from "../utils"
import type { AnyModel, ModelClass } from "./BaseModel"
import { modelTypeKey } from "./metadata"

interface ModelInfo {
  name: string
  class: ModelClass<AnyModel>
}

/**
 * @ignore
 */
export const modelInfoByName: {
  [name: string]: ModelInfo
} = {}

/**
 * @ignore
 */
export const modelInfoByClass = new Map<ModelClass<AnyModel>, ModelInfo>()

/**
 * @ignore
 */
export function getModelInfoForName(name: string): ModelInfo | undefined {
  return modelInfoByName[name]
}

/**
 * @ignore
 */
export function getModelInfoForObject(obj: { [modelTypeKey]: string }): ModelInfo | undefined {
  if (!isObject(obj)) {
    return undefined
  }
  const modelType = obj[modelTypeKey]
  return modelType ? getModelInfoForName(obj[modelTypeKey]) : undefined
}
