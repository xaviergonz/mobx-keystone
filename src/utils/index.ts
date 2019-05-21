export function mapGetOrDefault<K extends object, V>(
  map: WeakMap<K, V> | Map<K, V>,
  key: K,
  def: () => V
) {
  if (map.has(key)) {
    return map.get(key)!
  }
  const newValue = def()!
  map.set(key, newValue)
  return newValue
}

export class MobxStateTreeNextError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, MobxStateTreeNextError.prototype)
  }
}

export function failure(msg: string) {
  return new MobxStateTreeNextError(msg)
}

export function addHiddenProp(object: any, propName: PropertyKey, value: any) {
  Object.defineProperty(object, propName, {
    enumerable: false,
    writable: true,
    configurable: true,
    value,
  })
}

export function isPlainObject(value: any): value is Object {
  if (!isObject(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function isObject(value: any): value is Object {
  if (value === null || typeof value !== "object") return false
  return true
}

export function debugFreeze(value: object) {
  if (process.env.NODE_ENV !== "production") {
    Object.freeze(value)
  }
}
