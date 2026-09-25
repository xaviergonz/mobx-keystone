import type { Frozen, frozenKey } from "../frozen/Frozen"
import type { AnyModel } from "../model/BaseModel"
import type { modelIdKey, modelTypeKey } from "../model/metadata"
import type { ModelFromSnapshot, ModelToSnapshot } from "../modelShared/BaseModelShared"
import type { ArraySet, ObjectMap } from "../wrappers"

// this must be a type rather than an interface to ensure compatibility with index signatures
// (e.g. PlainObject)
export type FrozenData<D> = {
  [frozenKey]: true
  data: D
}

// snapshot out

export type SnapshotOutOfObject<T> = {
  [k in keyof T]: SnapshotOutOf<T[k]>
}

export type SnapshotOutOfModel<M extends AnyModel> = ModelToSnapshot<M>

export interface SnapshotOutOfFrozen<F extends Frozen<any>> extends FrozenData<F["data"]> {}

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

export type SnapshotOutOf<T> = T extends object
  ? T extends AnyModel
    ? T extends ObjectMap<infer V>
      ? SnapshotOutOfObjectMap<V>
      : T extends ArraySet<infer V>
        ? SnapshotOutOfArraySet<V>
        : SnapshotOutOfModel<T>
    : T extends Frozen<any>
      ? SnapshotOutOfFrozen<T>
      : SnapshotOutOfObject<T>
  : T

// snapshot in

export type SnapshotInOfObject<T> = {
  [k in keyof T]: SnapshotInOf<T[k]>
}

export type SnapshotInOfModel<M extends AnyModel> = ModelFromSnapshot<M>

export interface SnapshotInOfFrozen<F extends Frozen<any>> extends FrozenData<F["data"]> {}

export interface SnapshotInOfObjectMap<V> {
  items?: { [k: string]: SnapshotInOf<V> }
  [modelTypeKey]?: string
  [modelIdKey]: string
}

export interface SnapshotInOfArraySet<V> {
  items?: SnapshotInOf<V>[]
  [modelTypeKey]?: string
  [modelIdKey]: string
}

export type SnapshotInOf<T> = T extends object
  ? T extends AnyModel
    ? T extends ObjectMap<infer V>
      ? SnapshotInOfObjectMap<V>
      : T extends ArraySet<infer V>
        ? SnapshotInOfArraySet<V>
        : SnapshotInOfModel<T>
    : T extends Frozen<any>
      ? SnapshotInOfFrozen<T>
      : SnapshotInOfObject<T>
  : T
