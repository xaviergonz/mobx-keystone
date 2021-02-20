import { Frozen, frozenKey } from "../frozen/Frozen"
import { AnyModel, ModelPropsCreationData, ModelPropsData } from "../model/BaseModel"
import { modelIdKey, modelTypeKey } from "../model/metadata"
import { ArraySet, ObjectMap } from "../wrappers"

// snapshot out

// infer is there just to cache type generation

export type SnapshotOutOfObject<T> = {
  [k in keyof T]: SnapshotOutOf<T[k]> extends infer R ? R : never
}

export type SnapshotOutOfModel<M extends AnyModel> = SnapshotOutOfObject<ModelPropsData<M>> & {
  [modelTypeKey]: string
}

export type SnapshotOutOfFrozen<F extends Frozen<any>> = {
  [frozenKey]: true
  data: F["data"]
}

export interface SnapshotOutOfObjectMap<V> {
  items: { [k: string]: SnapshotOutOf<V> }
  [modelTypeKey]: string
  [modelIdKey]: string
}

export interface SnapshotOutOfArraySet<V> {
  items: SnapshotOutOf<V>[]
  [modelTypeKey]: string
  [modelIdKey]: string
}

export type SnapshotOutOf<T> = T extends ObjectMap<infer V>
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

// snapshot in

export type SnapshotInOfObject<T> = {
  [k in keyof T]: SnapshotInOf<T[k]> extends infer R ? R : never
}

export type SnapshotInOfModel<M extends AnyModel> = SnapshotInOfObject<
  M extends { fromSnapshot(sn: infer S): any } ? S : ModelPropsCreationData<M>
> & {
  [modelTypeKey]: string
}

export type SnapshotInOfFrozen<F extends Frozen<any>> = {
  [frozenKey]: true
  data: F["data"]
}

export interface SnapshotInOfObjectMap<V> {
  items?: { [k: string]: SnapshotOutOf<V> }
  [modelTypeKey]: string
  [modelIdKey]: string
}

export interface SnapshotInOfArraySet<V> {
  items?: SnapshotOutOf<V>[]
  [modelTypeKey]: string
  [modelIdKey]: string
}

export type SnapshotInOf<T> = T extends ObjectMap<infer V>
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
