import { compareTreePaths, getPathFromAncestor } from "../parent/treeOrder"

/**
 * The nodes below a root indexed by id, where several nodes may share an id.
 *
 * @internal
 */
export class NodesById<T extends object> {
  // (tree nodes are never sets)
  private readonly byId = new Map<string, T | Set<T>>()

  add(id: string, node: T): void {
    const existing = this.byId.get(id)
    if (existing === undefined) {
      this.byId.set(id, node)
    } else if (existing instanceof Set) {
      existing.add(node)
    } else {
      this.byId.set(id, new Set([existing, node]))
    }
  }

  delete(id: string, node: T): void {
    const existing = this.byId.get(id)
    if (existing instanceof Set) {
      existing.delete(node)
      if (existing.size === 1) {
        this.byId.set(id, existing.values().next().value!)
      }
    } else if (existing === node) {
      this.byId.delete(id)
    }
  }

  /** Resolves the node with the id, picking one when several share it. */
  resolve(root: object, id: string): T | undefined {
    const found = this.byId.get(id)
    return found instanceof Set ? resolveDuplicatedId(root, found) : found
  }
}

/**
 * Picks which of several nodes below the root sharing an id it resolves to:
 * an ancestor wins over its descendants, and otherwise the node below the
 * later attached child of their closest common ancestor wins. That is the last
 * one a post-order walk of the tree would find. Reactive, in
 * O(nodes × depth).
 */
function resolveDuplicatedId<T extends object>(root: object, nodes: Iterable<T>): T {
  let winner: T | undefined
  let winnerPath: object[] | undefined
  for (const node of nodes) {
    const path = getPathFromAncestor(root, node, true)!
    if (!winnerPath || compareTreePaths(path, winnerPath, false) > 0) {
      winner = node
      winnerPath = path
    }
  }
  return winner!
}
