type AnyMap<V = any> = Map<any, V> | WeakMap<any, V>

export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V
export function getOrCreate<K extends object, V>(map: WeakMap<K, V>, key: K, create: () => V): V

export function getOrCreate<V>(map: AnyMap<V>, key: any, create: () => V) {
  let value = map.get(key)
  if (value === undefined) {
    value = create()
    map.set(key, value)
  }
  return value
}
