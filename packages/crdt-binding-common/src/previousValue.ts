/**
 * Marks "no known previous native snapshot", so that `undefined` remains usable
 * as an ordinary previous value.
 *
 * Registered in the global symbol registry: each binding package bundles its own
 * copy of this module, and a plain `Symbol()` would make those copies disagree
 * if a previous value ever crossed between them.
 * @internal
 */
export const noPreviousValue = Symbol.for("mobx-keystone/crdt-binding/noPreviousValue")

/**
 * A previously known native snapshot value, or {@link noPreviousValue}.
 * @internal
 */
export type PreviousValue = unknown | typeof noPreviousValue

/**
 * Whether a destination already holds `source`.
 *
 * `mergeSnapshotChanges` returns the native snapshot's own subtrees by
 * reference wherever nothing changed, so reference identity against the
 * snapshot just read from the destination proves the whole subtree is already
 * in place and can be skipped without reading it back.
 * @internal
 */
export function isUnchangedSubtree(previous: PreviousValue, source: unknown): boolean {
  return previous !== noPreviousValue && Object.is(previous, source)
}

/**
 * Narrows a previous snapshot to an object whose keys can be descended into.
 * @internal
 */
export function previousObjectValue(previous: PreviousValue): Record<string, unknown> | undefined {
  return previous !== noPreviousValue && previous !== null && typeof previous === "object"
    ? (previous as Record<string, unknown>)
    : undefined
}
