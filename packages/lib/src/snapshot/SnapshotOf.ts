import { Frozen, frozenKey } from "../frozen/Frozen"
import { modelTypeKey } from "../model"
import { AnyModel, ModelCreationData, ModelData } from "../model/BaseModel"
import { ArraySet, ObjectMap } from "../wrappers"

// snapshot out

// infer is there just to cache type generation

export interface SnapshotOutOfArray<T> extends Array<SnapshotOutOf<T>> {}
export interface SnapshotOutOfReadonlyArray<T> extends ReadonlyArray<SnapshotOutOf<T>> {}

export type SnapshotOutOfObject<T extends { [k: string]: any }> = {
  [k in keyof T]: SnapshotOutOf<T[k]> extends infer R ? R : never
}

export type SnapshotOutOfModel<M extends AnyModel> = SnapshotOutOfObject<ModelData<M>> & {
  [modelTypeKey]: string
}

export type SnapshotOutOfFrozen<F extends Frozen<any>> = {
  [frozenKey]: true
  data: F["data"]
}

export interface SnapshotOutOfObjectMap<V> {
  items: { [k: string]: SnapshotOutOf<V> }
  [modelTypeKey]: string
}

export interface SnapshotOutOfArraySet<V> {
  items: SnapshotOutOf<V>[]
  [modelTypeKey]: string
}

export type SnapshotOutOf<T> = T extends Array<infer U>
  ? SnapshotOutOfArray<U> extends infer R
    ? R
    : never
  : T extends ReadonlyArray<infer U>
  ? SnapshotOutOfReadonlyArray<U> extends infer R
    ? R
    : never
  : T extends ObjectMap<infer V>
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

export interface SnapshotInOfArray<T> extends Array<SnapshotInOf<T>> {}
export interface SnapshotInOfReadonlyArray<T> extends ReadonlyArray<SnapshotInOf<T>> {}

export type SnapshotInOfObject<T extends { [k: string]: any }> = {
  [k in keyof T]: SnapshotInOf<T[k]> extends infer R ? R : never
}

export type SnapshotInOfModel<M extends AnyModel> = SnapshotInOfObject<
  M extends { fromSnapshot(sn: infer S): any } ? S : ModelCreationData<M>
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
}

export interface SnapshotInOfArraySet<V> {
  items?: SnapshotOutOf<V>[]
  [modelTypeKey]: string
}

export type SnapshotInOf<T> = T extends Array<infer U>
  ? SnapshotInOfArray<U> extends infer R
    ? R
    : never
  : T extends ReadonlyArray<infer U>
  ? SnapshotInOfReadonlyArray<U> extends infer R
    ? R
    : never
  : T extends ObjectMap<infer V>
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
