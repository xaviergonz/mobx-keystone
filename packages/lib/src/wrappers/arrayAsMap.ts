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
      const items = getTarget()
      items.length = 0
    },

    delete(key) {
      const items = getTarget()

      const index = items.findIndex(t => t[0] === key)
      if (index >= 0) {
        items.splice(index, 1)
        return true
      } else {
        return false
      }
    },

    forEach(callbackfn, thisArg) {
      const items = getTarget()

      const len = items.length
      for (let i = 0; i < len; i++) {
        const t = items[i]
        callbackfn.call(thisArg, t[1], t[0], map)
      }
    },

    get(key) {
      const items = getTarget()

      const found = items.find(t => t[0] === key)
      return found ? found[1] : undefined
    },

    has(key) {
      const items = getTarget()

      return items.some(t => t[0] === key)
    },

    set(key, value) {
      const items = getTarget()

      const found = items.find(t => t[0] === key)
      if (found) {
        found[1] = value
      } else {
        items.push([key, value])
      }

      return map
    },

    get size() {
      const items = getTarget()

      return items.length
    },

    keys() {
      const items = getTarget()

      // TODO: should use an actual iterator
      return items.map(t => t[0])[Symbol.iterator]()
    },

    values() {
      const items = getTarget()

      // TODO: should use an actual iterator
      return items.map(t => t[1])[Symbol.iterator]()
    },

    entries() {
      const items = getTarget()

      // we do the copy just to keep reactivity
      return items.map(t => [t[0], t[1]] as [string, V])[Symbol.iterator]()
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
