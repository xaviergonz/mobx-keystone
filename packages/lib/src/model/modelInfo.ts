import { modelTypeKey } from "../model/metadata"
import { getModelInfoForName, ModelInfo } from "../modelShared/modelInfo"
import { isObject } from "../utils"

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
