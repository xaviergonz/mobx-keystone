import { modelAction } from "../action/modelAction"
import { Model } from "../model/Model"
import { model } from "../model/modelDecorator"
import { typesRecord } from "../typeChecking/record"
import { tProp } from "../typeChecking/tProp"
import { typesUnchecked } from "../typeChecking/unchecked"
import { objectAsMap } from "./objectAsMap"

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
  private readonly _map = objectAsMap(() => this.items)

  @modelAction
  clear() {
    this._map.clear()
  }

  @modelAction
  delete(key: string) {
    return this._map.delete(key)
  }

  forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg: any) {
    // we cannot use the map implementation since we need to pass this as map
    Object.keys(this.items).forEach(k => {
      callbackfn.call(thisArg, this.items[k], k, this)
    })
  }

  get(key: string) {
    return this._map.get(key)
  }

  has(key: string) {
    return this._map.has(key)
  }

  @modelAction
  set(key: string, value: V) {
    this._map.set(key, value)
    return this
  }

  get size() {
    return this._map.size
  }

  keys() {
    return this._map.keys()
  }

  values() {
    return this._map.values()
  }

  entries() {
    return this._map.entries()
  }

  [Symbol.iterator]() {
    return this._map[Symbol.iterator]()
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
    for (const entry of entries) {
      initialObj[entry[0]] = entry[1]
    }
  }

  return new ObjectMap({ items: initialObj })
}
