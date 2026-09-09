import type { ArrayMoveChange } from "./moveWithinArray"

/**
 * Advances the local baseline by a move without including unrelated listener edits.
 * @internal
 */
export function applyArrayMoveToSnapshot(snapshot: unknown, move: ArrayMoveChange): unknown {
  const visit = (value: unknown, depth: number): unknown => {
    if (depth === move.path.length) {
      const result = (value as unknown[]).slice()
      const [item] = result.splice(move.fromIndex, 1)
      result.splice(move.toIndex, 0, item)
      return result
    }
    const key = move.path[depth]
    const child = visit((value as Record<string | number, unknown>)[key], depth + 1)
    if (Array.isArray(value)) {
      const result = value.slice()
      result[key as number] = child
      return result
    }
    return { ...(value as object), [key]: child }
  }
  return visit(snapshot, 0)
}
