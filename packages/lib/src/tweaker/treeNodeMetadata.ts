import type { ObjectChildrenData } from "../parent/coreObjectChildren"
import type { ParentPath } from "../parent/path"
import type { SnapshotData } from "../snapshot/internal"

/** @internal */
export interface TreeNodeMetadata {
  tweaked: boolean
  /**
   * Set once a plain object or array is fully tweaked, and unset when it is
   * untweaked. Its MobX handlers do nothing while unset.
   */
  handlersActive: boolean
  parentPath: ParentPath<object> | undefined
  dataObjectParent: object | undefined
  objectChildren: ObjectChildrenData | undefined
  snapshot: SnapshotData | undefined
  /**
   * Increases every time the node is added to a parent's children, so it
   * orders siblings like the parent's children set does.
   */
  attachOrder: number
}

/** @internal */
export const treeNodeMetadata = new WeakMap<object, TreeNodeMetadata>()

/** @internal */
export function getOrCreateTreeNodeMetadata(value: object): TreeNodeMetadata {
  let metadata = treeNodeMetadata.get(value)
  if (!metadata) {
    metadata = {
      tweaked: false,
      handlersActive: false,
      parentPath: undefined,
      dataObjectParent: undefined,
      objectChildren: undefined,
      snapshot: undefined,
      attachOrder: 0,
    }
    treeNodeMetadata.set(value, metadata)
  }
  return metadata
}

/** @internal */
export function markAsTweakedObject(value: object): void {
  getOrCreateTreeNodeMetadata(value).tweaked = true
}
