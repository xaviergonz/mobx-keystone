/**
 * Compare JSON-shaped values without interpreting data keys as object methods.
 * @internal
 */
export function jsonEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = a.length - 1; i >= 0; i--) {
      if (!jsonEquals(a[i], b[i])) return false
    }
    return true
  }
  if (Array.isArray(b)) return false

  // Shared CRDT containers and other non-JSON objects are not plain snapshots.
  const aProto = Object.getPrototypeOf(a)
  const bProto = Object.getPrototypeOf(b)
  if (
    (aProto !== Object.prototype && aProto !== null) ||
    (bProto !== Object.prototype && bProto !== null)
  )
    return false

  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) return false
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  for (const key of aKeys) {
    if (!Object.hasOwn(b, key) || !jsonEquals(aRecord[key], bRecord[key])) return false
  }
  return true
}
