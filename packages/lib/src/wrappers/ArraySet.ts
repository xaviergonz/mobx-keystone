import { values } from "mobx"
import { modelAction } from "../action/modelAction"
import { modelIdKey } from "../model/metadata"
import { Model } from "../model/Model"
import { model } from "../modelShared/modelDecorator"
import { idProp } from "../modelShared/prop"
import { typesArray } from "../types/arrayBased/array"
import { tProp } from "../types/tProp"
import { typesUnchecked } from "../types/utility/unchecked"

/**
 * A set that is backed by an array.
 * Use `arraySet` to create it.
 */
@model("mobx-keystone/ArraySet")
export class ArraySet<V>
  extends Model({
    [modelIdKey]: idProp,
    items: tProp(typesArray(typesUnchecked<any>()), () => []), // will be properly checked by types.arraySet(subType)
  })
  implements Set<V>
{
  @modelAction
  add(value: V): this {
    const items = this.items

    if (!items.includes(value)) {
      items.push(value)
    }
    return this
  }

  @modelAction
  clear(): void {
    this.items.length = 0
  }

  @modelAction
  delete(value: V): boolean {
    const items = this.items

    const index = items.findIndex((t) => t === value)
    if (index >= 0) {
      items.splice(index, 1)
      return true
    } else {
      return false
    }
  }

  forEach(callbackfn: (value: V, value2: V, set: Set<V>) => void, thisArg?: any): void {
    // we cannot use the set implementation since we need to pass this as set
    const items = this.items
    const len = items.length
    for (let i = 0; i < len; i++) {
      const k = items[i]
      callbackfn.call(thisArg, k, k, this)
    }
  }

  has(value: V): boolean {
    return this.items.includes(value)
  }

  get size(): number {
    return this.items.length
  }

  keys(): IterableIterator<V> {
    return this.values() // yes, values
  }

  values(): IterableIterator<V> {
    const items = this.items

    return values(items)[Symbol.iterator]()
  }

  entries(): IterableIterator<[V, V]> {
    const items = this.items

    // TODO: should use an actual iterator
    return items.map((v) => [v, v] as [V, V]).values()
  }

  [Symbol.iterator](): IterableIterator<V> {
    return this.values()
  }

  get [Symbol.toStringTag](): string {
    return "ArraySet"
  }
}

/**
 * Creates a new ArraySet model instance.
 *
 * @typeparam V Value type.
 * @param [entries] Optional initial values.
 */
export function arraySet<V>(values?: ReadonlyArray<V> | null): ArraySet<V> {
  const initialArr: V[] = values ? values.slice() : []

  return new ArraySet({ items: initialArr })
}
