import { runInAction } from "mobx"
import { getCurrentActionContext } from "../action/context"
import { getActionProtection } from "../action/protection"
import { failure, isPrimitive } from "../utils"

/**
 * @ignore
 */
export const tweakedObjects = new WeakSet<Object>()

/**
 * @ignore
 */
export function isTweakedObject(value: any): value is Object {
  return !isPrimitive(value) && tweakedObjects.has(value)
}

/**
 * Checks if a given object is now a tree node.
 *
 * @param value Value to check.
 * @returns ture if it is a tree node, false otherwise.
 */
export function isTreeNode(value: object): boolean {
  return isTweakedObject(value)
}

/**
 * @ignore
 */
export function assertTweakedObject(treeNode: any, argName: string): treeNode is Object {
  if (!isTweakedObject(treeNode)) {
    throw failure(
      `${argName} must be a tree node (usually a model or a shallow / deep child part of a model 'data' object)`
    )
  }
  return true
}

/**
 * @ignore
 */
export function canWrite(): boolean {
  return !getActionProtection() || !!getCurrentActionContext()
}

/**
 * @ignore
 */
export function assertCanWrite() {
  if (!canWrite()) {
    throw failure("data changes must be performed inside model actions")
  }
}

/**
 * @ignore
 */
export let runningWithoutSnapshotOrPatches = false

/**
 * @ignore
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
