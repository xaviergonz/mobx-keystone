import { isObject } from "../utils"
import { ModelMetadata, modelMetadataKey } from "./metadata"
import { ModelClass } from "./Model"

interface ModelInfo {
  name: string
  class: ModelClass
}

export const modelInfoByName: {
  [name: string]: ModelInfo
} = {}

export const modelInfoByClass = new Map<any, ModelInfo>()

export function getModelInfoForName(name: string): ModelInfo | undefined {
  return modelInfoByName[name]
}

export function getModelInfoForObject(obj: any): ModelInfo | undefined {
  if (!isObject(obj) || !obj[modelMetadataKey]) {
    return undefined
  }
  return getModelInfoForName((obj[modelMetadataKey] as ModelMetadata).type)
}
