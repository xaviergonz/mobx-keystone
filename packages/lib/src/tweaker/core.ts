import { runInAction } from "mobx"
import { hasDataObjectParent } from "../parent/core"
import { failure, isPrimitive } from "../utils"
import { type TreeNodeMetadata, treeNodeMetadata } from "./treeNodeMetadata"
import { resyncTweakedChangeListeners } from "./tweakedChangeListeners"

// untweaked objects that keep the MobX handlers they got when tweaked, which
// do nothing until they are tweaked again
const objectsWithIdleHandlers = new WeakSet<object>()

/**
 * Activates the MobX handlers of a fully tweaked plain object or array, and
 * returns whether they still have to be installed. Untweaking keeps them idle
 * rather than disposing them, so no disposers are kept for every node. When
 * idle handlers are reused, the tweaked change listeners are resynced, since
 * they missed the changes made while the handlers were idle.
 *
 * @internal
 */
export function activateHandlers(value: object): boolean {
  treeNodeMetadata.get(value)!.handlersActive = true
  if (!objectsWithIdleHandlers.delete(value)) {
    return true
  }
  resyncTweakedChangeListeners(value)
  return false
}

/**
 * Makes the MobX handlers of an untweaked plain object or array idle.
 *
 * @internal
 */
export function deactivateHandlers(value: object, metadata: TreeNodeMetadata): void {
  metadata.handlersActive = false
  objectsWithIdleHandlers.add(value)
}

/**
 * Whether the MobX handlers of a plain object or array are active.
 *
 * @internal
 */
export function areHandlersActive(value: object): boolean {
  return treeNodeMetadata.get(value)?.handlersActive === true
}

/**
 * @internal
 */
export function isTweakedObject(value: unknown, canBeDataObject: boolean): value is object {
  const metadata = treeNodeMetadata.get(value as object)
  return metadata?.tweaked === true && (canBeDataObject || metadata.dataObjectParent === undefined)
}

/**
 * Checks if a given object is now a tree node.
 *
 * @param value Value to check.
 * @returns true if it is a tree node, false otherwise.
 */
export function isTreeNode(value: unknown): value is object {
  return !isPrimitive(value) && isTweakedObject(value, false)
}

/**
 * @internal
 */
export function assertTweakedObject(
  treeNode: unknown,
  argName: string,
  canBeDataObject = false
): asserts treeNode is object {
  if (!canBeDataObject && hasDataObjectParent(treeNode as object)) {
    throw failure(`${argName} must be the model object instance instead of the '$' sub-object`)
  }
  if (isPrimitive(treeNode) || !isTweakedObject(treeNode, true)) {
    throw failure(
      `${argName} must be a tree node (usually a model or a shallow / deep child part of a model 'data' object)`
    )
  }
}

/**
 * Asserts a given object is now a tree node, or throws otherwise.
 *
 * @param value Value to check.
 * @param argName Argument name, part of the thrown error description.
 */
export function assertIsTreeNode(value: unknown, argName = "argument"): asserts value is object {
  assertTweakedObject(value, argName, false)
}

/**
 * @internal
 */
export let runningWithoutSnapshotOrPatches = false

/**
 * @internal
 */
export function runWithoutSnapshotOrPatches(fn: () => void) {
  const old = runningWithoutSnapshotOrPatches
  runningWithoutSnapshotOrPatches = true
  try {
    runInAction(() => {
      fn()
    })
  } finally {
    runningWithoutSnapshotOrPatches = old
  }
}
