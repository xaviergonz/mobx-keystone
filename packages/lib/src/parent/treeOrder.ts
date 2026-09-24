import { treeNodeMetadata } from "../tweaker/treeNodeMetadata"
import { reportParentPathObserved } from "./core"

/**
 * Nodes from right below the ancestor down to the node, or `undefined` when the
 * node is not below it. Optionally observes their parents.
 *
 * @internal
 */
export function getPathFromAncestor(
  ancestor: object,
  node: object,
  observeParents: boolean
): object[] | undefined {
  const path: object[] = []
  let current: object | undefined = node
  while (current !== ancestor) {
    if (!current) {
      return undefined
    }
    path.push(current)
    if (observeParents) {
      reportParentPathObserved(current)
    }
    current = treeNodeMetadata.get(current)?.parentPath?.parent
  }
  return path.reverse()
}

/**
 * Compares two paths from the same ancestor (see `getPathFromAncestor`) by the
 * order a walk of the tree visits their nodes. The walk visits the children of
 * a node in the order they were attached, and visits parents before their
 * children when `parentsFirst`, or after them otherwise.
 *
 * @internal
 */
export function compareTreePaths(
  a: readonly object[],
  b: readonly object[],
  parentsFirst: boolean
): number {
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) {
      // siblings
      return treeNodeMetadata.get(a[i])!.attachOrder - treeNodeMetadata.get(b[i])!.attachOrder
    }
  }
  // the shorter path ends at an ancestor of the other node
  const depthDifference = a.length - b.length
  return parentsFirst ? depthDifference : -depthDifference
}
