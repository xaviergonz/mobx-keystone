import { action } from "mobx"

class ArrayAsMap<K, V> implements Map<K, V> {
  constructor(private readonly getTarget: () => [K, V][]) {}

  @action
  clear(): void {
    const items = this.getTarget()
    items.length = 0
  }

  @action
  delete(key: K): boolean {
    const items = this.getTarget()

    const index = items.findIndex(t => t[0] === key)
    if (index >= 0) {
      items.splice(index, 1)
      return true
    } else {
      return false
    }
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
    const items = this.getTarget()

    const len = items.length
    for (let i = 0; i < len; i++) {
      const t = items[i]
      callbackfn.call(thisArg, t[1], t[0], this)
    }
  }

  get(key: K): V | undefined {
    const items = this.getTarget()

    const found = items.find(t => t[0] === key)
    return found ? found[1] : undefined
  }

  has(key: K): boolean {
    const items = this.getTarget()

    return items.some(t => t[0] === key)
  }

  @action
  set(key: K, value: V): this {
    const items = this.getTarget()

    const found = items.find(t => t[0] === key)
    if (found) {
      found[1] = value
    } else {
      items.push([key, value])
    }

    return this
  }

  get size(): number {
    const items = this.getTarget()

    return items.length
  }

  keys(): IterableIterator<K> {
    const items = this.getTarget()

    // TODO: should use an actual iterator
    return items.map(t => t[0])[Symbol.iterator]()
  }

  values(): IterableIterator<V> {
    const items = this.getTarget()

    // TODO: should use an actual iterator
    return items.map(t => t[1])[Symbol.iterator]()
  }

  entries(): IterableIterator<[K, V]> {
    const items = this.getTarget()

    // we do the copy just to keep reactivity
    return items.map(t => [t[0], t[1]] as [K, V])[Symbol.iterator]()
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries()
  }

  get [Symbol.toStringTag](): string {
    return "Map"
  }
}

/**
 * Returns a wrapper that wraps an observable tuple array `[K, V][]`
 * into a map alike interface.
 *
 * @typeparam K Key type
 * @typeparam V Value type
 * @param getTarget Target store array getter.
 * @returns
 */
export function arrayAsMap<K, V>(getTarget: () => [K, V][]): Map<K, V> {
  return new ArrayAsMap(getTarget)
}
