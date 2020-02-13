import { action, entries, get, has, keys, remove, set, values } from "mobx"

export class ObjectAsMap<V> implements Map<string, V> {
  constructor(private readonly getTarget: () => { [k: string]: V }) {}

  @action
  clear(): void {
    const items = this.getTarget()

    const keys = Object.keys(items)
    const len = keys.length
    for (let i = 0; i < len; i++) {
      const k = keys[i]
      remove(items, k)
    }
  }

  @action
  delete(key: string): boolean {
    const items = this.getTarget()

    const hasKey = this.has(key)
    if (hasKey) {
      remove(items, key)
      return true
    } else {
      return false
    }
  }

  forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg?: any): void {
    const items = this.getTarget()

    const keys = Object.keys(items)
    const len = keys.length
    for (let i = 0; i < len; i++) {
      const k = keys[i]
      callbackfn.call(thisArg, items[k], k, this)
    }
  }

  get(key: string): V | undefined {
    const items = this.getTarget()

    return get(items, key)
  }

  has(key: string): boolean {
    const items = this.getTarget()

    return has(items, key)
  }

  @action
  set(key: string, value: V): this {
    const items = this.getTarget()

    set(items, key, value)

    return this
  }

  get size(): number {
    const items = this.getTarget()

    return keys(items).length
  }

  keys(): IterableIterator<string> {
    const items = this.getTarget()

    // TODO: should use an actual iterator
    return keys(items)[Symbol.iterator]() as IterableIterator<string>
  }

  values(): IterableIterator<V> {
    const items = this.getTarget()

    // TODO: should use an actual iterator
    return values(items)[Symbol.iterator]()
  }

  entries(): IterableIterator<[string, V]> {
    const items = this.getTarget()

    // TODO: should use an actual iterator
    return entries(items)[Symbol.iterator]()
  }

  [Symbol.iterator](): IterableIterator<[string, V]> {
    return this.entries()
  }

  get [Symbol.toStringTag](): string {
    return "Map"
  }
}

/**
 * @deprecated Consider using `prop_mapObject` or `tProp_mapObject` instead.
 *
 * Returns a wrapper that wraps an observable object
 * `Record<string, V>` into a map alike interface.
 *
 * @typeparam V Value type
 * @param getTarget Target store object getter.
 * @returns
 */
export function objectAsMap<V>(getTarget: () => Record<string, V>): Map<string, V> {
  return new ObjectAsMap(getTarget)
}
