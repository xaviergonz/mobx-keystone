import { Model } from "../model/Model"

// snapshot out

export interface SnapshotOutOfArray<T> extends Array<SnapshotOutOf<T>> {}
export interface SnapshotOutOfReadonlyArray<T> extends ReadonlyArray<SnapshotOutOf<T>> {}

export type SnapshotOutOfObject<T extends object> = { [k in keyof T]: SnapshotOutOf<T[k]> }

export type SnapshotOutOfModel<M extends Model> = SnapshotInOfObject<M["data"]> & {
  $$typeof: M["$$typeof"]
  $$id: M["$$id"]
}

export type SnapshotOutOf<T> = T extends Array<infer U>
  ? SnapshotOutOfArray<U>
  : T extends ReadonlyArray<infer U>
  ? SnapshotOutOfReadonlyArray<U>
  : T extends Model
  ? SnapshotOutOfModel<T>
  : T extends object
  ? SnapshotOutOfObject<T>
  : T

// snapshot in

export interface SnapshotInOfArray<T> extends Array<SnapshotInOf<T>> {}
export interface SnapshotInOfReadonlyArray<T> extends ReadonlyArray<SnapshotInOf<T>> {}

export type SnapshotInOfObject<T extends object> = { [k in keyof T]: SnapshotInOf<T[k]> }

export type SnapshotInOfModel<M extends Model> = SnapshotOutOfObject<
  M extends { fromSnapshot(sn: infer S): any } ? S : M["data"]
> & {
  $$typeof: M["$$typeof"]
  $$id: M["$$id"]
}

export type SnapshotInOf<T> = T extends Array<infer U>
  ? SnapshotInOfArray<U>
  : T extends ReadonlyArray<infer U>
  ? SnapshotInOfReadonlyArray<U>
  : T extends Model
  ? SnapshotInOfModel<T>
  : T extends object
  ? SnapshotInOfObject<T>
  : T
