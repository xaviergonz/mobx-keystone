import { isObject } from "../utils"
import { AnyModel, ModelClass } from "./BaseModel"
import { ModelMetadata, modelMetadataKey } from "./metadata"

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
export function getModelInfoForObject(obj: {
  [modelMetadataKey]: ModelMetadata
}): ModelInfo | undefined {
  if (!isObject(obj) || !obj[modelMetadataKey]) {
    return undefined
  }
  return getModelInfoForName(obj[modelMetadataKey].type)
}

/**
 * @ignore
 */
export const modelConstructorSymbol = Symbol("modelConstructor")
