import { action, createAtom, IAtom } from "mobx"
import { fastGetRoot, isRoot } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import { attachToRootStore, detachFromRootStore } from "./attachDetach"

const rootStoreRegistry = new WeakMap<object, { atom: IAtom; is: boolean }>()

const getOrCreateRootStoreEntry = (node: object) =>
  getOrCreate(rootStoreRegistry, node, () => ({
    atom: createAtom("rootStore"),
    is: false,
  }))

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
export const registerRootStore: <T extends object>(node: T) => T = action(
  "registerRootStore",
  (node) => {
    assertTweakedObject(node, "node")

    const entry = getOrCreateRootStoreEntry(node)

    if (entry.is) {
      throw failure("object already registered as root store")
    }

    if (!isRoot(node)) {
      throw failure("a root store must not have a parent")
    }

    entry.is = true

    attachToRootStore(node, node)

    entry.atom.reportChanged()
    return node
  }
)

/**
 * Unregisters an object to mark it as no longer a root store.
 *
 * @param node Node object to unregister as root store.
 */
export const unregisterRootStore: (node: object) => void = action("unregisterRootStore", (node) => {
  if (!isRootStore(node)) {
    throw failure("not a root store")
  }

  const entry = getOrCreateRootStoreEntry(node)
  entry.is = false

  detachFromRootStore(node)

  entry.atom.reportChanged()
})

/**
 * Checks if a given object is marked as a root store.
 *
 * @param node Object.
 * @returns
 */
export function isRootStore(node: object): boolean {
  assertTweakedObject(node, "node")

  return fastIsRootStore(node)
}

/**
 * @internal
 */
export function fastIsRootStore(node: object): boolean {
  const entry = getOrCreateRootStoreEntry(node)
  entry.atom.reportObserved()
  return entry.is
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

  return fastGetRootStore(node)
}

/**
 * @internal
 */
export function fastGetRootStore<T extends object>(node: object): T | undefined {
  const root = fastGetRoot(node)
  return fastIsRootStore(root) ? root : undefined
}
