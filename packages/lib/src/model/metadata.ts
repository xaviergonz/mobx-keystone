/**
 * Key where model snapshots will store model type metadata.
 */
export const modelTypeKey = "$modelType"

/**
 * Returns if a given key is a reserved key in model snapshots.
 *
 * @param key
 * @returns
 */
export function isReservedModelKey(key: string) {
  return key === modelTypeKey
}
