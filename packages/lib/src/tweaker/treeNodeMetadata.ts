import type { ObjectChildrenData } from "../parent/coreObjectChildren"
import type { ParentPath } from "../parent/path"
import type { SnapshotData } from "../snapshot/internal"

/** @internal */
export interface TreeNodeMetadata {
  tweaked: boolean
  untweaker: (() => void) | undefined
  parentPath: ParentPath<object> | undefined
  dataObjectParent: object | undefined
  objectChildren: ObjectChildrenData | undefined
  snapshot: SnapshotData | undefined
}

/** @internal */
export const treeNodeMetadata = new WeakMap<object, TreeNodeMetadata>()

/** @internal */
export function getOrCreateTreeNodeMetadata(value: object): TreeNodeMetadata {
  let metadata = treeNodeMetadata.get(value)
  if (!metadata) {
    metadata = {
      tweaked: false,
      untweaker: undefined,
      parentPath: undefined,
      dataObjectParent: undefined,
      objectChildren: undefined,
      snapshot: undefined,
    }
    treeNodeMetadata.set(value, metadata)
  }
  return metadata
}

/** @internal */
export function markAsTweakedObject(value: object): void {
  getOrCreateTreeNodeMetadata(value).tweaked = true
}
