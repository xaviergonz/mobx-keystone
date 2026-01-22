/**
 * Implicit Treap (Treap by implicit key)
 *
 * A balanced BST where keys are implicit positions (0, 1, 2, ...).
 * Each node stores:
 * - value: the actual data (ContainerID in our case)
 * - priority: random value for heap property (ensures O(log n) height with high probability)
 * - size: subtree size (for computing implicit positions)
 * - left, right, parent: tree links
 *
 * Supports:
 * - Build from array: O(n)
 * - indexOf(value): O(log n) via value->node map + walking to root
 * - move(from, to): O(log n) via split/merge operations
 * - insert(index, value): O(log n)
 * - delete(index): O(log n)
 * - get(index): O(log n)
 * - size: O(1)
 */

interface TreapNode<T> {
  value: T
  priority: number
  size: number
  left: TreapNode<T> | null
  right: TreapNode<T> | null
  parent: TreapNode<T> | null
}

export class ImplicitTreap<T> {
  private root: TreapNode<T> | null = null
  private valueToNode: Map<T, TreapNode<T>> = new Map()

  /**
   * Build treap from array in O(n) time.
   * Uses the "build from sorted sequence" approach since positions are implicit.
   */
  static fromArray<T>(items: T[]): ImplicitTreap<T> {
    const treap = new ImplicitTreap<T>()
    if (items.length === 0) return treap

    // Build nodes with random priorities
    const nodes: TreapNode<T>[] = items.map((value) => ({
      value,
      priority: Math.random(),
      size: 1,
      left: null,
      right: null,
      parent: null,
    }))

    // Register in map
    for (const node of nodes) {
      treap.valueToNode.set(node.value, node)
    }

    // Build balanced tree using divide-and-conquer
    treap.root = treap.buildTree(nodes, 0, nodes.length - 1, null)
    return treap
  }

  /**
   * Build a balanced subtree from nodes[lo..hi].
   * We pick the node with max priority as root (to maintain heap property),
   * then recursively build left and right subtrees.
   */
  private buildTree(
    nodes: TreapNode<T>[],
    lo: number,
    hi: number,
    parent: TreapNode<T> | null
  ): TreapNode<T> | null {
    if (lo > hi) return null

    // Find max priority in range
    let maxIdx = lo
    for (let i = lo + 1; i <= hi; i++) {
      if (nodes[i].priority > nodes[maxIdx].priority) {
        maxIdx = i
      }
    }

    const node = nodes[maxIdx]
    node.parent = parent
    node.left = this.buildTree(nodes, lo, maxIdx - 1, node)
    node.right = this.buildTree(nodes, maxIdx + 1, hi, node)
    this.updateSize(node)
    return node
  }

  private updateSize(node: TreapNode<T>): void {
    node.size = 1 + this.getSize(node.left) + this.getSize(node.right)
  }

  private getSize(node: TreapNode<T> | null): number {
    return node ? node.size : 0
  }

  /**
   * Get the index of a value in O(log n).
   * Walk from node to root, counting elements to the left.
   */
  indexOf(value: T): number {
    const node = this.valueToNode.get(value)
    if (!node) return -1

    let index = this.getSize(node.left)
    let current: TreapNode<T> = node

    while (current.parent) {
      const parent: TreapNode<T> = current.parent
      if (current === parent.right) {
        // We're the right child, add parent + parent's left subtree
        index += 1 + this.getSize(parent.left)
      }
      current = parent
    }

    return index
  }

  /**
   * Move element from position `from` to position `to` in O(log n).
   *
   * This mirrors what loroList.move(from, to) does:
   * - Remove element at `from`
   * - Insert it at position `to` in the resulting array
   *
   * Example: [A,B,C,D,E].move(0, 2) -> [B,C,A,D,E]
   * - Remove A from position 0: [B,C,D,E]
   * - Insert A at position 2: [B,C,A,D,E]
   */
  move(from: number, to: number): void {
    if (from === to) return

    // Extract node at position `from`
    const [left, nodeAndRight] = this.splitBySize(this.root, from)
    const [nodeTree, right] = this.splitBySize(nodeAndRight, 1)

    if (!nodeTree) {
      // Shouldn't happen if indices are valid
      this.root = this.merge(left, right)
      return
    }

    // Merge left and right (without the node)
    let merged = this.merge(left, right)

    // Insert nodeTree at position `to` in the merged tree
    // `to` is the target position in the array AFTER removal
    const [insertLeft, insertRight] = this.splitBySize(merged, to)
    merged = this.merge(insertLeft, nodeTree)
    this.root = this.merge(merged, insertRight)
  }

  /**
   * Get total size of treap in O(1).
   */
  get length(): number {
    return this.getSize(this.root)
  }

  /**
   * Check if a value exists in the treap in O(1).
   */
  has(value: T): boolean {
    return this.valueToNode.has(value)
  }

  /**
   * Get value at index in O(log n).
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.length) return undefined
    const node = this.getNodeAtIndex(this.root, index)
    return node?.value
  }

  /**
   * Get node at a specific index.
   */
  private getNodeAtIndex(node: TreapNode<T> | null, index: number): TreapNode<T> | null {
    if (!node) return null

    const leftSize = this.getSize(node.left)
    if (index < leftSize) {
      return this.getNodeAtIndex(node.left, index)
    } else if (index === leftSize) {
      return node
    } else {
      return this.getNodeAtIndex(node.right, index - leftSize - 1)
    }
  }

  /**
   * Insert a value at a specific index in O(log n).
   */
  insert(index: number, value: T): void {
    if (this.valueToNode.has(value)) {
      throw new Error("Value already exists in treap")
    }

    const newNode: TreapNode<T> = {
      value,
      priority: Math.random(),
      size: 1,
      left: null,
      right: null,
      parent: null,
    }

    this.valueToNode.set(value, newNode)

    // Split at index, insert node, merge back
    const [left, right] = this.splitBySize(this.root, index)
    const merged = this.merge(left, newNode)
    this.root = this.merge(merged, right)
  }

  /**
   * Delete value at a specific index in O(log n).
   * Returns the deleted value, or undefined if index is out of bounds.
   */
  deleteAt(index: number): T | undefined {
    if (index < 0 || index >= this.length) return undefined

    // Split to extract the node at index
    const [left, nodeAndRight] = this.splitBySize(this.root, index)
    const [nodeTree, right] = this.splitBySize(nodeAndRight, 1)

    if (!nodeTree) {
      this.root = this.merge(left, right)
      return undefined
    }

    const value = nodeTree.value
    this.valueToNode.delete(value)

    // Merge left and right without the deleted node
    this.root = this.merge(left, right)
    return value
  }

  /**
   * Delete a specific value from the treap in O(log n).
   * Returns true if the value was found and deleted.
   */
  delete(value: T): boolean {
    const index = this.indexOf(value)
    if (index === -1) return false
    this.deleteAt(index)
    return true
  }

  /**
   * Split treap into [0..k-1] and [k..n-1].
   * Returns [leftTree, rightTree].
   */
  private splitBySize(
    node: TreapNode<T> | null,
    k: number
  ): [TreapNode<T> | null, TreapNode<T> | null] {
    if (!node) return [null, null]

    const leftSize = this.getSize(node.left)

    if (leftSize >= k) {
      // Split in left subtree
      const [ll, lr] = this.splitBySize(node.left, k)
      node.left = lr
      if (lr) lr.parent = node
      this.updateSize(node)
      if (ll) ll.parent = null
      node.parent = null
      return [ll, node]
    } else {
      // Split in right subtree
      const [rl, rr] = this.splitBySize(node.right, k - leftSize - 1)
      node.right = rl
      if (rl) rl.parent = node
      this.updateSize(node)
      if (rr) rr.parent = null
      node.parent = null
      return [node, rr]
    }
  }

  /**
   * Merge two treaps where all keys in `left` < all keys in `right`.
   * Uses priority to maintain heap property.
   */
  private merge(left: TreapNode<T> | null, right: TreapNode<T> | null): TreapNode<T> | null {
    if (!left) return right
    if (!right) return left

    if (left.priority > right.priority) {
      left.right = this.merge(left.right, right)
      if (left.right) left.right.parent = left
      this.updateSize(left)
      left.parent = null
      return left
    } else {
      right.left = this.merge(left, right.left)
      if (right.left) right.left.parent = right
      this.updateSize(right)
      right.parent = null
      return right
    }
  }
}
