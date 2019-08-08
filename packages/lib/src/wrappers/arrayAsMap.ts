/**
 * Returns a wrapper that wraps an observable tuple array `[string, V][]`
 * into a map alike interface.
 *
 * @typeparam V Value type
 * @param getTarget Target store array getter.
 * @returns
 */
export function arrayAsMap<V>(getTarget: () => [string, V][]): Map<string, V> {
  const map: Map<string, V> = {
    clear() {
      const o = getTarget()
      o.length = 0
    },

    delete(key) {
      const o = getTarget()

      const index = o.findIndex(t => t[0] === key)
      if (index >= 0) {
        o.splice(index, 1)
        return true
      } else {
        return false
      }
    },

    forEach(callbackfn, thisArg) {
      const o = getTarget()

      o.forEach(t => {
        callbackfn.call(thisArg, t[1], t[0], map)
      })
    },

    get(key) {
      const o = getTarget()

      const found = o.find(t => t[0] === key)
      return found ? found[1] : undefined
    },

    has(key) {
      const o = getTarget()

      return o.some(t => t[0] === key)
    },

    set(key, value) {
      const o = getTarget()

      const found = o.find(t => t[0] === key)
      if (found) {
        found[1] = value
      } else {
        o.push([key, value])
      }

      return map
    },

    get size() {
      const o = getTarget()

      return o.length
    },

    keys() {
      const o = getTarget()

      // TODO: should use an actual iterator
      return o.map(t => t[0])[Symbol.iterator]()
    },

    values() {
      const o = getTarget()

      // TODO: should use an actual iterator
      return o.map(t => t[1])[Symbol.iterator]()
    },

    entries() {
      const o = getTarget()

      return o[Symbol.iterator]()
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
