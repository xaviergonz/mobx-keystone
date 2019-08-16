import { modelAction } from "../action/modelAction"
import { Model } from "../model/Model"
import { model } from "../model/modelDecorator"
import { typesArray } from "../typeChecking/array"
import { tProp } from "../typeChecking/tProp"
import { typesUnchecked } from "../typeChecking/unchecked"

/**
 * A set that is backed by an array.
 * Use `arraySet` to create it.
 */
@model("mobx-keystone/ArraySet")
export class ArraySet<V>
  extends Model({
    items: tProp(typesArray(typesUnchecked<any>()), () => []), // will be properly checked by types.arraySet(subType)
  })
  implements Set<V> {
  @modelAction
  add(value: V) {
    const items = this.items

    if (!items.includes(value)) {
      items.push(value)
    }
    return this
  }

  @modelAction
  clear() {
    this.items.length = 0
  }

  @modelAction
  delete(value: V) {
    const items = this.items

    const index = items.findIndex(t => t === value)
    if (index >= 0) {
      items.splice(index, 1)
      return true
    } else {
      return false
    }
  }

  forEach(callbackfn: (value: V, value2: V, set: Set<V>) => void, thisArg: any) {
    // we cannot use the set implementation since we need to pass this as set
    this.items.forEach(k => {
      callbackfn.call(thisArg, k, k, this)
    })
  }

  has(value: V) {
    return this.items.includes(value)
  }

  get size() {
    return this.items.length
  }

  keys() {
    return this.values() // yes, values
  }

  values() {
    const items = this.items

    items.length // just to mark the atom as observed
    return items.values()
  }

  entries() {
    const items = this.items

    // TODO: should use an actual iterator
    return items.map(v => [v, v] as [V, V]).values()
  }

  [Symbol.iterator]() {
    return this.values()
  }

  get [Symbol.toStringTag]() {
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
