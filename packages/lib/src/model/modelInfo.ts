import { isObject } from "../utils"
import { modelMetadataKey } from "./metadata"
import { AnyModel, ModelClass } from "./Model"

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
export const modelInfoByClass = new Map<any, ModelInfo>()

/**
 * @ignore
 */
export function getModelInfoForName(name: string): ModelInfo | undefined {
  return modelInfoByName[name]
}

/**
 * @ignore
 */
export function getModelInfoForObject(obj: any): ModelInfo | undefined {
  if (!isObject(obj) || !obj[modelMetadataKey]) {
    return undefined
  }
  return getModelInfoForName((obj as AnyModel)[modelMetadataKey].type)
}
