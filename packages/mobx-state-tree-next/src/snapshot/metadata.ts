export const modelMetadataKey = "$$metadata"

export interface ModelMetadata {
  type: string
  id: string
}

export function isInternalKey(key: string) {
  return key === modelMetadataKey
}
