export interface PatchBaseOperation {
  path: string
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

export type PatchOperation<T = any> =
  | PatchAddOperation<T>
  | PatchRemoveOperation
  | PatchReplaceOperation<T>
