import { ModelClass } from "./Model"
import { typeofKey } from "../snapshot/metadata"
import { isObject } from "../utils"

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
  if (!isObject(obj) || !obj[typeofKey]) {
    return undefined
  }
  return getModelInfoForName(obj[typeofKey])
}
