import { Model } from "../model"

export interface SnapshotOfArray<T> extends Array<SnapshotOf<T>> {}
export interface SnapshotOfReadonlyArray<T> extends ReadonlyArray<SnapshotOf<T>> {}

export type SnapshotOfObject<T extends object> = { [k in keyof T]: SnapshotOf<T[k]> }

export type SnapshotOf<T> = T extends Array<infer U>
  ? SnapshotOfArray<U>
  : T extends ReadonlyArray<infer U>
  ? SnapshotOfReadonlyArray<U>
  : T extends Model
  ? SnapshotOfObject<T["data"]> & { $$typeof: string }
  : T extends object
  ? SnapshotOfObject<T>
  : T
