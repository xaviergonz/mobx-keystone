/**
 * Key where model snapshots will store model metadata.
 */
export const modelMetadataKey = "$$metadata"

/**
 * Model metadata stored in model snapshots.
 */
export interface ModelMetadata {
  /**
   * Model type
   */
  readonly type: string

  /**
   * Model unique id.
   */
  readonly id: string
}

/**
 * Returns if a given key is a reserved key in model snapshots.
 *
 * @param key
 * @returns
 */
export function isReservedModelKey(key: string) {
  return key === modelMetadataKey
}
