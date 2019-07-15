import { Frozen } from "../frozen/Frozen"
import { AnyModel, ModelData } from "../model/Model"
import { ModelCreationData } from "../model/newModel"

// snapshot out

export interface SnapshotOutOfArray<T> extends Array<SnapshotOutOf<T>> {}
export interface SnapshotOutOfReadonlyArray<T> extends ReadonlyArray<SnapshotOutOf<T>> {}

export type SnapshotOutOfObject<T extends { [k: string]: any }> = {
  [k in keyof T]: SnapshotOutOf<T[k]>
}

export type SnapshotOutOfModel<M extends AnyModel> = SnapshotOutOfObject<ModelData<M>> & {
  $$metadata: M["$$metadata"]
}

export type SnapshotOutOfFrozen<F extends Frozen<any>> = {
  $$frozen: true
  data: F["data"]
}

export type SnapshotOutOf<T> = T extends Array<infer U>
  ? SnapshotOutOfArray<U>
  : T extends ReadonlyArray<infer U>
  ? SnapshotOutOfReadonlyArray<U>
  : T extends AnyModel
  ? SnapshotOutOfModel<T>
  : T extends Frozen<any>
  ? SnapshotOutOfFrozen<T>
  : T extends object
  ? SnapshotOutOfObject<T>
  : T

// snapshot in

export interface SnapshotInOfArray<T> extends Array<SnapshotInOf<T>> {}
export interface SnapshotInOfReadonlyArray<T> extends ReadonlyArray<SnapshotInOf<T>> {}

export type SnapshotInOfObject<T extends { [k: string]: any }> = {
  [k in keyof T]: SnapshotInOf<T[k]>
}

export type SnapshotInOfModel<M extends AnyModel> = SnapshotInOfObject<
  M extends { fromSnapshot(sn: infer S): any } ? S : ModelCreationData<M>
> & {
  $$metadata: M["$$metadata"]
}

export type SnapshotInOfFrozen<F extends Frozen<any>> = {
  $$frozen: true
  data: F["data"]
}

export type SnapshotInOf<T> = T extends Array<infer U>
  ? SnapshotInOfArray<U>
  : T extends ReadonlyArray<infer U>
  ? SnapshotInOfReadonlyArray<U>
  : T extends AnyModel
  ? SnapshotInOfModel<T>
  : T extends Frozen<any>
  ? SnapshotInOfFrozen<T>
  : T extends object
  ? SnapshotInOfObject<T>
  : T
