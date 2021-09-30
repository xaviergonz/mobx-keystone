/**
 * Key where model snapshots will store model type metadata.
 */
export const modelTypeKey = "$modelType"

/**
 * Key that serves as proxy to the model property designed as 'idProp' (if any).
 */
export const modelIdKey = "$modelId"

/**
 * @internal
 * Returns if a given key is a reserved key in model snapshots.
 *
 * @param key
 * @returns
 */
export function isReservedModelKey(key: string) {
  // note $modelId is NOT a reserved key, since it will eventually end up in the data
  // and can actually be changed
  return key === modelTypeKey
}
