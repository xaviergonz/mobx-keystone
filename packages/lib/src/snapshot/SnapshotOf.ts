import type { Frozen, frozenKey } from "../frozen/Frozen"
import type { AnyModel } from "../model/BaseModel"
import type { modelIdKey, modelTypeKey } from "../model/metadata"
import type { ModelFromSnapshot, ModelToSnapshot } from "../modelShared/BaseModelShared"
import type { ArraySet, ObjectMap } from "../wrappers"

/** @ignore */
export declare const snapshotOutOverrideSymbol: unique symbol

/** @ignore */
export declare const snapshotInOverrideSymbol: unique symbol

// snapshot out

// infer is there just to cache type generation

export type SnapshotOutOfObject<T> = {
  [k in keyof T]: SnapshotOutOf<T[k]> extends infer R ? R : never
}

export type SnapshotOutOfModel<M extends AnyModel> = ModelToSnapshot<M>

export type SnapshotOutOfFrozen<F extends Frozen<any>> = {
  [frozenKey]: true
  data: F["data"]
}

export interface SnapshotOutOfObjectMap<V> {
  items: { [k: string]: SnapshotOutOf<V> }
  [modelTypeKey]?: string
  [modelIdKey]: string
}

export interface SnapshotOutOfArraySet<V> {
  items: SnapshotOutOf<V>[]
  [modelTypeKey]?: string
  [modelIdKey]: string
}

type _SnapshotOutOf<T> = T extends ObjectMap<infer V>
  ? SnapshotOutOfObjectMap<V> extends infer R
    ? R
    : never
  : T extends ArraySet<infer V>
  ? SnapshotOutOfArraySet<V> extends infer R
    ? R
    : never
  : T extends AnyModel
  ? SnapshotOutOfModel<T> extends infer R
    ? R
    : never
  : T extends Frozen<any>
  ? SnapshotOutOfFrozen<T> extends infer R
    ? R
    : never
  : T extends object
  ? SnapshotOutOfObject<T> extends infer R
    ? R
    : never
  : T

export type SnapshotOutOf<T> = T extends { [snapshotOutOverrideSymbol]?: infer O }
  ? O extends { [snapshotOutOverrideSymbol]: infer O2 }
    ? O2
    : _SnapshotOutOf<T>
  : _SnapshotOutOf<T>

// snapshot in

export type SnapshotInOfObject<T> = {
  [k in keyof T]: SnapshotInOf<T[k]> extends infer R ? R : never
}

export type SnapshotInOfModel<M extends AnyModel> = ModelFromSnapshot<M>

export type SnapshotInOfFrozen<F extends Frozen<any>> = {
  [frozenKey]: true
  data: F["data"]
}

export interface SnapshotInOfObjectMap<V> {
  items?: { [k: string]: SnapshotOutOf<V> }
  [modelTypeKey]?: string
  [modelIdKey]: string
}

export interface SnapshotInOfArraySet<V> {
  items?: SnapshotOutOf<V>[]
  [modelTypeKey]?: string
  [modelIdKey]: string
}

type _SnapshotInOf<T> = T extends ObjectMap<infer V>
  ? SnapshotInOfObjectMap<V> extends infer R
    ? R
    : never
  : T extends ArraySet<infer V>
  ? SnapshotInOfArraySet<V> extends infer R
    ? R
    : never
  : T extends AnyModel
  ? SnapshotInOfModel<T> extends infer R
    ? R
    : never
  : T extends Frozen<any>
  ? SnapshotInOfFrozen<T> extends infer R
    ? R
    : never
  : T extends object
  ? SnapshotInOfObject<T> extends infer R
    ? R
    : never
  : T

export type SnapshotInOf<T> = T extends { [snapshotInOverrideSymbol]?: infer O }
  ? O extends { [snapshotInOverrideSymbol]: infer O2 }
    ? O2
    : _SnapshotInOf<T>
  : _SnapshotInOf<T>
