import { LateTypeChecker, TypeChecker } from "../typeChecking/TypeChecker"
import { isObject } from "../utils"
import { ModelMetadata, modelMetadataKey } from "./metadata"
import { AnyModel, ModelClass } from "./Model"

interface ModelInfo {
  name: string
  class: ModelClass<AnyModel>
  dataTypeChecker?: TypeChecker | LateTypeChecker
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
