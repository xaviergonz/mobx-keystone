/**
 * A tree.
 */
export interface Tree<V> {
  readonly value: V
  readonly forest: ReadonlyArray<Tree<V>>
}

/**
 * Draws a tree using unicode characters.
 *
 * @param tree The tree to draw.
 * @returns A unicode drawing of the tree.
 */
export function drawTree(tree: Tree<string>): string {
  return tree.value + drawForest(tree.forest, "\n")
}

/**
 * @ignore
 */
function drawForest(forest: ReadonlyArray<Tree<string>>, indentation: string): string {
  let result: string = ""
  const numTrees = forest.length
  const last = numTrees - 1
  for (let i = 0; i < forest.length; i++) {
    const tree = forest[i]
    const isLast = i === last
    result += indentation + (isLast ? "└" : "├") + "─ " + tree.value
    result += drawForest(tree.forest, indentation + (numTrees > 1 && !isLast ? "│  " : "   "))
  }
  return result
}
