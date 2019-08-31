import { action } from "mobx"
import { fastGetRoot, isRoot } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { attachToRootStore, detachFromRootStore } from "./attachDetach"

const rootStores = new WeakSet<object>()

/**
 * Registers a model / tree node object as a root store tree.
 * Marking a model object as a root store tree serves several purposes:
 * - It allows the `onAttachedToRootStore` hook (plus disposer) to be invoked on models once they become part of this tree.
 *   These hooks can be used for example to attach effects and serve as some sort of initialization.
 * - It allows auto detachable references to work properly.
 *
 * @typeparam T Object type.
 * @param node Node object to register as root store.
 * @returns The same model object that was passed.
 */
export const registerRootStore = action(
  "registerRootStore",
  <T extends object>(node: T): T => {
    assertTweakedObject(node, "node")

    if (rootStores.has(node)) {
      throw failure("object already marked as root store")
    }

    if (!isRoot(node)) {
      throw failure("a root store must not have a parent")
    }

    rootStores.add(node)

    attachToRootStore(node, node)

    return node
  }
)

/**
 * Unregisters an object to mark it as no longer a root store.
 *
 * @param node Node object to unregister as root store.
 */
export const unregisterRootStore = action("unregisterRootStore", (node: object): void => {
  if (!isRootStore(node)) {
    throw failure("not a root store")
  }

  rootStores.delete(node)

  detachFromRootStore(node)
})

/**
 * Checks if a given object is marked as a root store.
 *
 * @param node Object.
 * @returns
 */
export function isRootStore(node: object): boolean {
  return rootStores.has(node)
}

/**
 * Gets the root store of a given tree child, or undefined if none.
 *
 * @typeparam T Root store type.
 * @param node Target to find the root store for.
 * @returns
 */
export function getRootStore<T extends object>(node: object): T | undefined {
  assertTweakedObject(node, "node")

  const root = fastGetRoot(node)
  return isRootStore(root) ? root : undefined
}
