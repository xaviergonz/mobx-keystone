import { entries, get, has, keys, remove, set, values } from "mobx"
import { modelAction } from "../action/modelAction"
import { modelIdKey } from "../model/metadata"
import { Model } from "../model/Model"
import { model } from "../modelShared/modelDecorator"
import { idProp } from "../modelShared/prop"
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
    [modelIdKey]: idProp,
    items: tProp(typesRecord(typesUnchecked<any>()), () => ({})), // will be properly checked by types.objectMap(subType)
  })
  implements Map<string, V>
{
  @modelAction
  clear(): void {
    const items = this.items

    const keys = Object.keys(items)
    const len = keys.length
    for (let i = 0; i < len; i++) {
      const k = keys[i]
      remove(items, k)
    }
  }

  @modelAction
  delete(key: string): boolean {
    const hasKey = this.has(key)
    if (hasKey) {
      remove(this.items, key)
      return true
    } else {
      return false
    }
  }

  forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg?: any): void {
    // we cannot use the map implementation since we need to pass this as map
    const items = this.items

    const keys = Object.keys(items)
    const len = keys.length
    for (let i = 0; i < len; i++) {
      const k = keys[i]
      callbackfn.call(thisArg, items[k], k, this)
    }
  }

  get(key: string): V | undefined {
    return get(this.items, key)
  }

  has(key: string): boolean {
    return has(this.items, key)
  }

  @modelAction
  set(key: string, value: V): this {
    set(this.items, key, value)
    return this
  }

  get size(): number {
    return keys(this.items).length
  }

  keys(): IterableIterator<string> {
    // TODO: should use an actual iterator
    return keys(this.items)[Symbol.iterator]() as IterableIterator<string>
  }

  values(): IterableIterator<V> {
    // TODO: should use an actual iterator
    return values(this.items)[Symbol.iterator]()
  }

  entries(): IterableIterator<[string, V]> {
    // TODO: should use an actual iterator
    return entries(this.items)[Symbol.iterator]()
  }

  [Symbol.iterator](): IterableIterator<[string, V]> {
    return this.entries()
  }

  get [Symbol.toStringTag](): string {
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
