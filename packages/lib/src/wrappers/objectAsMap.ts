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
      const o = getTarget()
      Object.keys(o).forEach(k => {
        delete o[k]
      })
    },

    delete(key) {
      const o = getTarget()

      const hasKey = map.has(key)
      if (hasKey) {
        delete o[key]
        return true
      } else {
        return false
      }
    },

    forEach(callbackfn, thisArg) {
      const o = getTarget()

      Object.keys(o).forEach(k => {
        callbackfn.call(thisArg, o[k], k, map)
      })
    },

    get(key) {
      const o = getTarget()

      return o[key]
    },

    has(key) {
      const o = getTarget()

      return key in o
    },

    set(key, value) {
      const o = getTarget()

      o[key] = value

      return map
    },

    get size() {
      const o = getTarget()

      return Object.keys(o).length
    },

    keys() {
      const o = getTarget()

      // TODO: should use an actual iterator
      return Object.keys(o)[Symbol.iterator]()
    },

    values() {
      const o = getTarget()

      // TODO: should use an actual iterator
      return Object.values(o)[Symbol.iterator]()
    },

    entries() {
      const o = getTarget()

      // TODO: should use an actual iterator
      return Object.entries(o)[Symbol.iterator]()
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
