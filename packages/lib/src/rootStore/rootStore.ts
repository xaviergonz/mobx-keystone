import { action } from "mobx"
import { AnyModel } from "../model/Model"
import { assertIsModel } from "../model/utils"
import { getParent, getRoot } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { attachToRootStore, detachFromRootStore } from "./attachDetach"

const rootStores = new WeakSet<AnyModel>()

/**
 * Registers a model object as a root store tree.
 * Marking a model object as a root store tree serves several purposes:
 * - It allows the `onAttachedToRootStore` hook (plus disposer) to be invoked on models once they become part of this tree.
 *   These hooks can be used for example to attach effects and serve as some sort of initialization.
 * - It allows auto detachable references to work properly.
 *
 * @typeparam T Model type.
 * @param model Model object.
 * @returns The same model object that was passed.
 */
export const registerRootStore = action(
  "registerRootStore",
  <T extends AnyModel>(model: T): T => {
    assertIsModel(model, "a root store")

    if (rootStores.has(model)) {
      throw failure("model already marked as root store")
    }

    if (getParent(model)) {
      throw failure("a root store must not have a parent")
    }

    rootStores.add(model)

    attachToRootStore(model, model)

    return model
  }
)

/**
 * Unregisters a model object to mark it as no longer a root store.
 *
 * @param model Model object.
 */
export const unregisterRootStore = action("unregisterRootStore", (model: AnyModel): void => {
  if (!isRootStore(model)) {
    throw failure("not a root store")
  }

  rootStores.delete(model)

  detachFromRootStore(model)
})

/**
 * Checks if a given model object is marked as a root store.
 *
 * @param model Model object.
 * @returns
 */
export function isRootStore(model: AnyModel): boolean {
  return rootStores.has(model as any)
}

/**
 * Gets the root store of a given tree child, or undefined if none.
 *
 * @typeparam T Root store type.
 * @param target Target to find the root store for.
 * @returns
 */
export function getRootStore<T extends AnyModel>(target: object): T | undefined {
  assertTweakedObject(target, "getRootStore")

  const root = getRoot(target)
  return isRootStore(root) ? root : undefined
}
