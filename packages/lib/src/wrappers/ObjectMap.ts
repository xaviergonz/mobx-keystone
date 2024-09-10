import { entries, get, has, keys, remove, values } from "mobx"
import { modelAction } from "../action/modelAction"
import { Model } from "../model/Model"
import { modelIdKey } from "../model/metadata"
import { model } from "../modelShared/modelDecorator"
import { idProp } from "../modelShared/prop"
import { typesRecord } from "../types/objectBased/typesRecord"
import { tProp } from "../types/tProp"
import { typesUnchecked } from "../types/utility/typesUnchecked"
import { namespace } from "../utils"
import { setIfDifferent } from "../utils/setIfDifferent"

/**
 * A map that is backed by an object-like map.
 * Use `objectMap` to create it.
 */
@model(`${namespace}/ObjectMap`)
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
    setIfDifferent(this.items, key, value)
    return this
  }

  get size(): number {
    return keys(this.items).length
  }

  keys(): ReturnType<Map<string, V>["keys"]> {
    // TODO: should use an actual iterator
    return keys(this.items)[Symbol.iterator]() as ReturnType<Map<string, V>["keys"]>
  }

  values(): ReturnType<Map<string, V>["values"]> {
    // TODO: should use an actual iterator
    return values(this.items)[Symbol.iterator]()
  }

  entries(): ReturnType<Map<string, V>["entries"]> {
    // TODO: should use an actual iterator
    return entries(this.items)[Symbol.iterator]()
  }

  [Symbol.iterator](): ReturnType<Map<string, V>[typeof Symbol.iterator]> {
    return this.entries()
  }

  readonly [Symbol.toStringTag] = "ObjectMap"
}

/**
 * Creates a new ObjectMap model instance.
 *
 * @typeparam V Value type.
 * @param [entries] Optional initial values.
 */
export function objectMap<V>(entries?: ReadonlyArray<readonly [string, V]> | null): ObjectMap<V> {
  const initialObj: Record<string, V> = {}

  if (entries) {
    const len = entries.length
    for (let i = 0; i < len; i++) {
      const entry = entries[i]
      initialObj[entry[0]] = entry[1]
    }
  }

  return new ObjectMap({ items: initialObj })
}
