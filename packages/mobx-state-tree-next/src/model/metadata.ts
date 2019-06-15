export const modelMetadataKey = "$$metadata"

export interface ModelMetadata {
  type: string
  id: string
}

export function isModelInternalKey(key: string) {
  return key === modelMetadataKey
}
