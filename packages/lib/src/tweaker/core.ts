import { runInAction } from "mobx"
import { dataObjectParent } from "../parent/core"
import { failure, isPrimitive } from "../utils"

/**
 * @internal
 */
export const tweakedObjects = new WeakMap<Object, undefined | (() => void)>()

/**
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
export function assertIsTreeNode(
  value: unknown,
  argName: string = "argument"
): asserts value is object {
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
