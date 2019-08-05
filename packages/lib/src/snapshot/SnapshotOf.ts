import { Frozen } from "../frozen/Frozen"
import { AnyModel, ModelCreationData, ModelData } from "../model/BaseModel"

// snapshot out

// infer is there just to cache type generation

export interface SnapshotOutOfArray<T> extends Array<SnapshotOutOf<T>> {}
export interface SnapshotOutOfReadonlyArray<T> extends ReadonlyArray<SnapshotOutOf<T>> {}

export type SnapshotOutOfObject<T extends { [k: string]: any }> = {
  [k in keyof T]: SnapshotOutOf<T[k]> extends infer R ? R : never
}

export type SnapshotOutOfModel<M extends AnyModel> = SnapshotOutOfObject<ModelData<M>> & {
  $$metadata: M["$$metadata"]
}

export type SnapshotOutOfFrozen<F extends Frozen<any>> = {
  $$frozen: true
  data: F["$"]
}

export type SnapshotOutOf<T> = T extends Array<infer U>
  ? SnapshotOutOfArray<U> extends infer R
    ? R
    : never
  : T extends ReadonlyArray<infer U>
  ? SnapshotOutOfReadonlyArray<U> extends infer R
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
  $$metadata: M["$$metadata"]
}

export type SnapshotInOfFrozen<F extends Frozen<any>> = {
  $$frozen: true
  data: F["$"]
}

export type SnapshotInOf<T> = T extends Array<infer U>
  ? SnapshotInOfArray<U> extends infer R
    ? R
    : never
  : T extends ReadonlyArray<infer U>
  ? SnapshotInOfReadonlyArray<U> extends infer R
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
