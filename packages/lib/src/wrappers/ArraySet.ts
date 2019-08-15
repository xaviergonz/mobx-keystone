import { modelAction } from "../action/modelAction"
import { Model } from "../model/Model"
import { model } from "../model/modelDecorator"
import { typesArray } from "../typeChecking/array"
import { tProp } from "../typeChecking/tProp"
import { typesUnchecked } from "../typeChecking/unchecked"
import { arrayAsSet } from "./arrayAsSet"

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
  private readonly _set = arrayAsSet(() => this.items)

  @modelAction
  add(value: V) {
    this._set.add(value)
    return this
  }

  @modelAction
  clear() {
    this._set.clear()
  }

  @modelAction
  delete(value: V) {
    return this._set.delete(value)
  }

  forEach(callbackfn: (value: V, value2: V, set: Set<V>) => void, thisArg: any) {
    // we cannot use the set implementation since we need to pass this as set
    this.items.forEach(k => {
      callbackfn.call(thisArg, k, k, this)
    })
  }

  has(value: V) {
    return this._set.has(value)
  }

  get size() {
    return this._set.size
  }

  keys() {
    return this._set.keys()
  }

  values() {
    return this._set.values()
  }

  entries() {
    return this._set.entries()
  }

  [Symbol.iterator]() {
    return this._set[Symbol.iterator]()
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
  const initialObj: V[] = values ? values.slice() : []

  return new ArraySet({ items: initialObj })
}
