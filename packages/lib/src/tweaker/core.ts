import { runInAction } from "mobx"
import { hasDataObjectParent } from "../parent/core"
import { failure, isPrimitive } from "../utils"
import { treeNodeMetadata } from "./treeNodeMetadata"

type Untweaker = (() => void) & {
  [secondaryUntweakerSymbol]?: () => void
}

const secondaryUntweakerSymbol = Symbol("secondaryUntweaker")

/**
 * Stores two existing cleanup functions without allocating a third function to
 * close over them. The primary function is internal and never exposed.
 *
 * @internal
 */
export function setTweakedObjectUntweakers(
  value: object,
  primaryUntweaker: Untweaker,
  secondaryUntweaker: () => void
): void {
  primaryUntweaker[secondaryUntweakerSymbol] = secondaryUntweaker
  treeNodeMetadata.get(value)!.untweaker = primaryUntweaker
}

/**
 * @internal
 */
export function isTweakedObject(value: unknown, canBeDataObject: boolean): value is object {
  if (!canBeDataObject && hasDataObjectParent(value as object)) {
    return false
  }
  return treeNodeMetadata.get(value as object)?.tweaked === true
}

/**
 * @internal
 */
export function runTweakedObjectUntweakers(untweaker: Untweaker): void {
  untweaker()
  untweaker[secondaryUntweakerSymbol]?.()
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
