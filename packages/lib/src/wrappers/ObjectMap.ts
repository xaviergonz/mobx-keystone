import {
  createAtom,
  entries,
  get,
  has,
  type IAtom,
  type IObjectDidChange,
  keys,
  observe,
  remove,
  values,
} from "mobx"
import { modelAction } from "../action/modelAction"
import type { AnyModel } from "../model/BaseModel"
import { modelIdKey } from "../model/metadata"
import { Model } from "../model/Model"
import { model } from "../modelShared/modelDecorator"
import { idProp } from "../modelShared/prop"
import { typesRecord } from "../types/objectBased/typesRecord"
import { tProp } from "../types/tProp"
import { typesUnchecked } from "../types/utility/typesUnchecked"
import { hasOwnProp, namespace, setProtoProp } from "../utils"
import { setIfDifferent } from "../utils/setIfDifferent"

const objectPrototype = Object.prototype

/**
 * Per items object, an atom per key named like an Object.prototype property
 * (e.g. `toString` or `__proto__`) that changes when that entry is added or removed.
 */
const inheritedNameKeyAtoms = new WeakMap<object, Map<string, IAtom>>()

/**
 * MobX may resolve keys through the prototype chain, so the key it subscribes to for a name
 * inherited from Object.prototype counts as present whether the entry exists or not, and adding
 * or removing the entry does not notify. This subscribes to an atom that does.
 */
function reportInheritedNameKeyObserved(items: object, key: string): void {
  let atoms = inheritedNameKeyAtoms.get(items)
  if (!atoms) {
    const newAtoms = new Map<string, IAtom>()
    // kept for as long as items (there are only so many inherited names): a computed read in
    // an action can track an atom without MobX reporting it as observed, so there is no
    // reliable point to dispose them
    observe(items, (change: IObjectDidChange) => {
      if (change.type === "add" || change.type === "remove") {
        newAtoms.get(change.name as string)?.reportChanged()
      }
    })
    inheritedNameKeyAtoms.set(items, newAtoms)
    atoms = newAtoms
  }

  let atom = atoms.get(key)
  if (!atom) {
    atom = createAtom(`ObjectMap.${key}?`)
    atoms.set(key, atom)
  }
  atom.reportObserved()
}

const objectMapBase = Model({
  [modelIdKey]: idProp,
  items: tProp(typesRecord(typesUnchecked<any>()), () => ({})), // will be properly checked by types.objectMap(subType)
}) as abstract new (data: any) => AnyModel & {
  readonly $: {
    items: Record<string, any>
  }
  readonly items: Record<string, any>
}

/**
 * A map that is backed by an object-like map.
 * Use `objectMap` to create it.
 */
@model(`${namespace}/ObjectMap`)
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging -- model base defines these properties at runtime.
export class ObjectMap<V> extends objectMapBase implements Map<string, V> {
  @modelAction
  clear(): void {
    const items = this.items

    // Object.keys is enough here: this is a write, so there is nothing to observe.
    const itemKeys = Object.keys(items)
    const len = itemKeys.length
    for (let i = 0; i < len; i++) {
      remove(items, itemKeys[i])
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

    const itemKeys = keys(items)
    const len = itemKeys.length
    for (let i = 0; i < len; i++) {
      const k = itemKeys[i] as string
      callbackfn.call(thisArg, items[k], k, this)
    }
  }

  get(key: string): V | undefined {
    const items = this.items
    const value = get(items, key)
    // MobX may resolve keys through the prototype chain, so properties inherited from
    // Object.prototype can show up as values
    if (value !== undefined && key in objectPrototype && !hasOwnProp(items, key)) {
      reportInheritedNameKeyObserved(items, key)
      return undefined
    }
    return value
  }

  getOrInsert(key: string, defaultValue: V): V {
    return this.getOrInsertComputed(key, () => defaultValue)
  }

  getOrInsertComputed(key: string, callback: (key: string) => V): V {
    if (this.has(key)) {
      return this.get(key) as V
    }

    const value = callback(key)
    this.set(key, value)
    return this.get(key) as V
  }

  has(key: string): boolean {
    const items = this.items
    // this read also subscribes to the key while it is missing
    if (!has(items, key)) {
      return false
    }
    // items inherits from Object.prototype, so any other key MobX reports is an own entry
    if (key in objectPrototype) {
      reportInheritedNameKeyObserved(items, key)
      return hasOwnProp(items, key)
    }
    return true
  }

  @modelAction
  set(key: string, value: V): this {
    setIfDifferent(this.items, key, value)
    return this
  }

  get size(): number {
    return keys(this.items).length
  }

  *keys(): ReturnType<Map<string, V>["keys"]> {
    for (const key of keys(this.items)) {
      yield key as string
    }
  }

  *values(): ReturnType<Map<string, V>["values"]> {
    for (const value of values(this.items)) {
      yield value
    }
  }

  *entries(): ReturnType<Map<string, V>["entries"]> {
    for (const entry of entries(this.items)) {
      yield entry
    }
  }

  [Symbol.iterator](): ReturnType<Map<string, V>[typeof Symbol.iterator]> {
    return this.entries()
  }

  readonly [Symbol.toStringTag] = "ObjectMap"
}

export interface ObjectMap<V> {
  readonly $: {
    items: Record<string, V>
  }
  readonly items: Record<string, V>
}

/**
 * Creates a new ObjectMap model instance.
 *
 * @template V Value type.
 * @param [entries] Optional initial values.
 */
export function objectMap<V>(entries?: ReadonlyArray<readonly [string, V]> | null): ObjectMap<V> {
  const initialObj: Record<string, V> = {}

  if (entries) {
    const len = entries.length
    for (let i = 0; i < len; i++) {
      const entry = entries[i]
      if (entry[0] === "__proto__") {
        setProtoProp(initialObj, entry[1])
      } else {
        initialObj[entry[0]] = entry[1]
      }
    }
  }

  return new ObjectMap({ items: initialObj })
}
