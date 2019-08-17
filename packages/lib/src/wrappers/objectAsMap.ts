import { entries, get, has, keys, remove, set, values } from "mobx"

/**
 * Returns a wrapper that wraps an observable object
 * `{ [k: string]: V }` into a map alike interface.
 *
 * @typeparam V Value type
 * @param getTarget Target store object getter.
 * @returns
 */
export function objectAsMap<V>(getTarget: () => { [k: string]: V }): Map<string, V> {
  const map: Map<string, V> = {
    clear() {
      const items = getTarget()
      Object.keys(items).forEach(k => {
        remove(items, k)
      })
    },

    delete(key) {
      const items = getTarget()

      const hasKey = map.has(key)
      if (hasKey) {
        remove(items, key)
        return true
      } else {
        return false
      }
    },

    forEach(callbackfn, thisArg) {
      const items = getTarget()

      Object.keys(items).forEach(k => {
        callbackfn.call(thisArg, items[k], k, map)
      })
    },

    get(key) {
      const items = getTarget()

      return get(items, key)
    },

    has(key) {
      const items = getTarget()

      return has(items, key)
    },

    set(key, value) {
      const items = getTarget()

      set(items, key, value)

      return map
    },

    get size() {
      const items = getTarget()

      return keys(items).length
    },

    keys() {
      const items = getTarget()

      // TODO: should use an actual iterator
      return keys(items)[Symbol.iterator]()
    },

    values() {
      const items = getTarget()

      // TODO: should use an actual iterator
      return values(items)[Symbol.iterator]()
    },

    entries() {
      const items = getTarget()

      // TODO: should use an actual iterator
      return entries(items)[Symbol.iterator]()
    },

    [Symbol.iterator]() {
      return map.entries()
    },

    get [Symbol.toStringTag]() {
      return "Map"
    },
  }

  return map
}
