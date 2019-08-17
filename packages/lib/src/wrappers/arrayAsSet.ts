import { values } from "mobx"

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
      const items = getTarget()

      if (!items.includes(value)) {
        items.push(value)
      }

      return set
    },

    clear() {
      const items = getTarget()

      items.length = 0
    },

    delete(value) {
      const items = getTarget()

      const index = items.findIndex(t => t === value)
      if (index >= 0) {
        items.splice(index, 1)
        return true
      } else {
        return false
      }
    },

    forEach(callbackfn, thisArg) {
      const items = getTarget()

      items.forEach(t => {
        callbackfn.call(thisArg, t, t, set)
      })
    },

    has(value) {
      const items = getTarget()

      return items.includes(value)
    },

    get size() {
      const items = getTarget()

      return items.length
    },

    keys() {
      return set.values() // yes, values
    },

    values() {
      const items = getTarget()

      return values(items)[Symbol.iterator]() as any
    },

    entries() {
      const items = getTarget()

      // TODO: should use an actual iterator
      return items.map(v => [v, v] as [V, V]).values()
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
