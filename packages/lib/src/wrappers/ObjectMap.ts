import { modelAction } from "../action/modelAction"
import { Model } from "../model/Model"
import { model } from "../model/modelDecorator"
import { typesRecord } from "../typeChecking/record"
import { tProp } from "../typeChecking/tProp"
import { typesUnchecked } from "../typeChecking/unchecked"

/**
 * A map that is backed by an object-like map.
 * Use `objectMap` to create it.
 */
@model("mobx-keystone/ObjectMap")
export class ObjectMap<V>
  extends Model({
    items: tProp(typesRecord(typesUnchecked<any>()), () => ({})), // will be properly checked by types.objectMap(subType)
  })
  implements Map<string, V> {
  @modelAction
  clear() {
    const items = this.items
    Object.keys(items).forEach(k => {
      delete items[k]
    })
  }

  @modelAction
  delete(key: string) {
    const hasKey = this.has(key)
    if (hasKey) {
      delete this.items[key]
      return true
    } else {
      return false
    }
  }

  forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg: any) {
    // we cannot use the map implementation since we need to pass this as map
    const items = this.items
    Object.keys(items).forEach(k => {
      callbackfn.call(thisArg, items[k], k, this)
    })
  }

  get(key: string) {
    return this.items[key]
  }

  has(key: string) {
    return key in this.items
  }

  @modelAction
  set(key: string, value: V) {
    this.items[key] = value
    return this
  }

  get size() {
    return Object.keys(this.items).length
  }

  keys() {
    // TODO: should use an actual iterator
    return Object.keys(this.items)[Symbol.iterator]()
  }

  values() {
    // TODO: should use an actual iterator
    return Object.values(this.items)[Symbol.iterator]()
  }

  entries() {
    // TODO: should use an actual iterator
    return Object.entries(this.items)[Symbol.iterator]()
  }

  [Symbol.iterator]() {
    return this.entries()
  }

  get [Symbol.toStringTag]() {
    return "ObjectMap"
  }
}

/**
 * Creates a new ObjectMap model instance.
 *
 * @typeparam V Value type.
 * @param [entries] Optional initial values.
 */
export function objectMap<V>(entries?: ReadonlyArray<readonly [string, V]> | null): ObjectMap<V> {
  const initialObj: { [k: string]: V } = {}

  if (entries) {
    let len = entries.length
    for (let i = 0; i < len; i++) {
      const entry = entries[i]
      initialObj[entry[0]] = entry[1]
    }
  }

  return new ObjectMap({ items: initialObj })
}
