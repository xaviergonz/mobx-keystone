import { runInAction } from "mobx"
import { getCurrentActionContext } from "../action/context"
import { getActionProtection } from "../action/protection"
import { dataObjectParent } from "../parent/core"
import { failure, isPrimitive } from "../utils"

/**
 * @ignore
 * @internal
 */
export const tweakedObjects = new WeakMap<Object, undefined | (() => void)>()

/**
 * @ignore
 * @internal
 */
export function isTweakedObject(value: unknown, canBeDataObject: boolean): value is object {
  if (!canBeDataObject && dataObjectParent.has(value as object)) {
    return false
  }
  return tweakedObjects.has(value as object)
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
 * @ignore
 * @internal
 */
export function assertTweakedObject(
  treeNode: unknown,
  argName: string,
  canBeDataObject = false
): asserts treeNode is object {
  if (!canBeDataObject && dataObjectParent.has(treeNode as object)) {
    throw failure(`${argName} must be the model object instance instead of the '$' sub-object`)
  }
  if (!isTreeNode(treeNode)) {
    throw failure(
      `${argName} must be a tree node (usually a model or a shallow / deep child part of a model 'data' object)`
    )
  }
}

/**
 * @ignore
 * @internal
 */
export function canWrite(): boolean {
  return !getActionProtection() || !!getCurrentActionContext()
}

/**
 * @ignore
 * @internal
 */
export function assertCanWrite() {
  if (!canWrite()) {
    throw failure("data changes must be performed inside model actions")
  }
}

/**
 * @ignore
 * @internal
 */
export let runningWithoutSnapshotOrPatches = false

/**
 * @ignore
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
