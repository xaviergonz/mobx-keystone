import { action, values } from "mobx"

export class ArrayAsSet<V> implements Set<V> {
  constructor(private readonly getTarget: () => V[]) {}

  @action
  add(value: V): this {
    const items = this.getTarget()

    if (!items.includes(value)) {
      items.push(value)
    }

    return this
  }

  @action
  clear(): void {
    const items = this.getTarget()

    items.length = 0
  }

  @action
  delete(value: V): boolean {
    const items = this.getTarget()

    const index = items.findIndex(t => t === value)
    if (index >= 0) {
      items.splice(index, 1)
      return true
    } else {
      return false
    }
  }

  forEach(callbackfn: (value: V, value2: V, set: Set<V>) => void, thisArg?: any): void {
    const items = this.getTarget()

    const len = items.length
    for (let i = 0; i < len; i++) {
      const t = items[i]
      callbackfn.call(thisArg, t, t, this)
    }
  }

  has(value: V): boolean {
    const items = this.getTarget()

    return items.includes(value)
  }

  get size(): number {
    const items = this.getTarget()

    return items.length
  }

  keys(): IterableIterator<V> {
    return this.values() // yes, values
  }

  values(): IterableIterator<V> {
    const items = this.getTarget()

    return values(items)[Symbol.iterator]() as IterableIterator<V>
  }

  entries(): IterableIterator<[V, V]> {
    const items = this.getTarget()

    // TODO: should use an actual iterator
    return items.map(v => [v, v] as [V, V]).values()
  }

  [Symbol.iterator](): IterableIterator<V> {
    return this.values()
  }

  get [Symbol.toStringTag](): string {
    return "Set"
  }
}

/**
 * @deprecated Consider using `prop_setArray` or `tProp_setArray` instead.
 *
 * Returns a wrapper that wraps an observable array `V[]`
 * into a set alike interface.
 *
 * @typeparam V Value type
 * @param getTarget Target store array getter.
 * @returns
 */
export function arrayAsSet<V>(getTarget: () => V[]): Set<V> {
  return new ArrayAsSet(getTarget)
}
