/**
 * Key where model snapshots will store model type metadata.
 */
export const modelTypeKey = "$modelType"

/**
 * Key where model snapshots will store model internal IDs metadata.
 */
export const modelIdKey = "$modelId"

/**
 * Symbol to be able to override model ID when using new.
 */
export const modelId = Symbol("$modelId")

/**
 * Returns if a given key is a reserved key in model snapshots.
 *
 * @param key
 * @returns
 */
export function isReservedModelKey(key: string) {
  return key === modelTypeKey || key === modelIdKey
}
