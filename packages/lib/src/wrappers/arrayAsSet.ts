/**
 * Returns a wrapper that wraps an observable array `V[]`
 * into a set alike interface.
 *
 * @typeparam V Value type
 * @param getTarget Target store array getter.
 * @returns
 */
export function arrayAsSet<V>(getTarget: () => V[]): Set<V> {
  const set: Set<V> = {
    add(value) {
      const o = getTarget()

      if (!o.includes(value)) {
        o.push(value)
      }

      return set
    },

    clear() {
      const o = getTarget()

      o.length = 0
    },

    delete(value) {
      const o = getTarget()

      const index = o.findIndex(t => t === value)
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
        callbackfn.call(thisArg, t, t, set)
      })
    },

    has(value) {
      const o = getTarget()

      return o.includes(value)
    },

    get size() {
      const o = getTarget()

      return o.length
    },

    keys() {
      return set.values() // yes, values
    },

    values() {
      const o = getTarget()

      o.length // just to mark the atom as observed
      return o.values()
    },

    entries() {
      const o = getTarget()

      // TODO: should use an actual iterator
      return o.map(v => [v, v] as [V, V]).values()
    },

    [Symbol.iterator]() {
      return set.values()
    },

    get [Symbol.toStringTag]() {
      return "Set"
    },
  }

  return set
}
