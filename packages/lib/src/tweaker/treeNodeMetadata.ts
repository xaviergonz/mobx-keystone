/**
 * State shared by the core tree-node subsystems. The concrete field types stay
 * private to their owning modules to keep this low-level store dependency-free.
 *
 * @internal
 */
export interface TreeNodeMetadata {
  tweaked: boolean
  untweaker: (() => void) | undefined
  parentPath: unknown
  dataObjectParent: object | undefined
  snapshot: unknown
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
