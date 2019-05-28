export const typeofKey = "$$typeof"
export const modelIdKey = "$$id"

export function isInternalKey(key: string) {
  return key === typeofKey || key === modelIdKey
}
