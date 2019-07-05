import { action } from "mobx"
import { getParent, getRoot } from "../parent/path"
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
 * @param model Model object.
 * @returns The same model object that was passed.
 */
export const registerRootStore: <T extends object>(object: T) => T = action(
  "registerRootStore",
  <T extends object>(object: T): T => {
    assertTweakedObject(object, "a root store")

    if (rootStores.has(object)) {
      throw failure("object already marked as root store")
    }

    if (getParent(object)) {
      throw failure("a root store must not have a parent")
    }

    rootStores.add(object)

    attachToRootStore(object, object)

    return object
  }
)

/**
 * Unregisters an object to mark it as no longer a root store.
 *
 * @param model Model object.
 */
export const unregisterRootStore: (object: object) => void = action(
  "unregisterRootStore",
  (object: object): void => {
    if (!isRootStore(object)) {
      throw failure("not a root store")
    }

    rootStores.delete(object)

    detachFromRootStore(object)
  }
)

/**
 * Checks if a given object is marked as a root store.
 *
 * @param object Object.
 * @returns
 */
export function isRootStore(object: object): boolean {
  return rootStores.has(object)
}

/**
 * Gets the root store of a given tree child, or undefined if none.
 *
 * @typeparam T Root store type.
 * @param target Target to find the root store for.
 * @returns
 */
export function getRootStore<T extends object>(target: object): T | undefined {
  assertTweakedObject(target, "getRootStore")

  const root = getRoot(target)
  return isRootStore(root) ? root : undefined
}
