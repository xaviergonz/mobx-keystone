import { modelAction } from "../action/modelAction"
import type { AnyModel } from "../model/BaseModel"
import { Model } from "../model/Model"
import { modelIdKey } from "../model/metadata"
import { model } from "../modelShared/modelDecorator"
import { idProp } from "../modelShared/prop"
import { typesArray } from "../types/arrayBased/typesArray"
import { tProp } from "../types/tProp"
import { typesUnchecked } from "../types/utility/typesUnchecked"
import { namespace } from "../utils"
import {
  isSetLikeDisjointFrom,
  isSetLikeSubsetOf,
  isSetLikeSupersetOf,
  setLikeDifference,
  setLikeIntersection,
  setLikeSymmetricDifference,
  setLikeUnion,
} from "../utils/setLike"

const arraySetBase = Model({
  [modelIdKey]: idProp,
  items: tProp(typesArray(typesUnchecked<any>()), () => []), // will be properly checked by types.arraySet(subType)
}) as abstract new (
  data: any
) => AnyModel & {
  readonly $: {
    items: any[]
  }
  readonly items: any[]
}

/**
 * A set that is backed by an array.
 * Use `arraySet` to create it.
 */
@model(`${namespace}/ArraySet`)
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: model base defines these properties at runtime.
export class ArraySet<V> extends arraySetBase implements Set<V> {
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

    const index = Number.isNaN(value) ? items.findIndex(Number.isNaN) : items.indexOf(value)
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

  keys(): ReturnType<Set<V>["keys"]> {
    return this.values()
  }

  *values(): ReturnType<Set<V>["values"]> {
    for (const value of this.items) {
      yield value as V
    }
  }

  *entries(): ReturnType<Set<V>["entries"]> {
    for (const v of this.items) {
      yield [v, v]
    }
  }

  [Symbol.iterator](): ReturnType<Set<V>[typeof Symbol.iterator]> {
    return this.values()
  }

  readonly [Symbol.toStringTag] = "ArraySet"

  // `has` scans the items, so the set operations look values up in a set built
  // on the first lookup instead (not before, since many of them never look up)
  private toSetLike(): ReadonlySetLike<V> {
    let lookup: Set<V> | undefined
    return {
      size: this.items.length,
      has: (value) => (lookup ??= new Set(this.items)).has(value),
      keys: () => this.values(),
    }
  }

  union<U>(other: ReadonlySetLike<U>): Set<V | U> {
    return setLikeUnion(this.toSetLike(), other)
  }

  intersection<U>(other: ReadonlySetLike<U>): Set<V & U> {
    return setLikeIntersection(this.toSetLike(), other)
  }

  difference<U>(other: ReadonlySetLike<U>): Set<V> {
    return setLikeDifference(this.toSetLike(), other)
  }

  symmetricDifference<U>(other: ReadonlySetLike<U>): Set<V | U> {
    return setLikeSymmetricDifference(this.toSetLike(), other)
  }

  isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
    return isSetLikeSubsetOf(this.toSetLike(), other)
  }

  isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
    return isSetLikeSupersetOf(this.toSetLike(), other)
  }

  isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
    return isSetLikeDisjointFrom(this.toSetLike(), other)
  }
}

export interface ArraySet<V> {
  readonly $: {
    items: V[]
  }
  readonly items: V[]
}

/**
 * Creates a new ArraySet model instance.
 *
 * @template V Value type.
 * @param [values] Optional initial values.
 */
export function arraySet<V>(values?: ReadonlyArray<V> | null): ArraySet<V> {
  const initialArr: V[] = values ? Array.from(new Set(values)) : []

  return new ArraySet({ items: initialArr })
}
