export const tweakedObjects = new WeakSet<Object>()

export function isTweakedObject(value: any): value is Object {
  return tweakedObjects.has(value)
}
