import { Path } from "../parent/pathTypes"

export declare type Patch =
  | PatchAddOperation<any>
  | PatchRemoveOperation
  | PatchReplaceOperation<any>

export interface PatchBaseOperation {
  path: Path
}

export interface PatchAddOperation<T> extends PatchBaseOperation {
  op: "add"
  value: T
}

export interface PatchRemoveOperation extends PatchBaseOperation {
  op: "remove"
}

export interface PatchReplaceOperation<T> extends PatchBaseOperation {
  op: "replace"
  value: T
}
