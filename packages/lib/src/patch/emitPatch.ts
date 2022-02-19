import { action, isAction } from "mobx"
import { fastGetParentPath } from "../parent/path"
import type { PathElement } from "../parent/pathTypes"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction, deleteFromArray } from "../utils"
import type { Patch } from "./Patch"

/**
 * @internal
 */
export class InternalPatchRecorder {
  patches!: Patch[]
  invPatches!: Patch[]

  record(patches: Patch[], invPatches: Patch[]) {
    this.patches = patches
    this.invPatches = invPatches
  }

  emit(obj: object) {
    emitPatch(obj, this.patches, this.invPatches, true)
  }
}

/**
 * A function that gets called when a patch is emitted.
 */
export type OnPatchesListener = (patches: Patch[], inversePatches: Patch[]) => void

/**
 * A function that gets called when a global patch is emitted.
 */
export type OnGlobalPatchesListener = (
  target: object,
  patches: Patch[],
  inversePatches: Patch[]
) => void

/**
 * Disposer function to stop listening to patches.
 */
export type OnPatchesDisposer = () => void

const patchListeners = new WeakMap<object, OnPatchesListener[]>()
const globalPatchListeners: OnGlobalPatchesListener[] = []

/**
 * Adds a listener that will be called every time a patch is generated for the tree of the given target object.
 *
 * @param subtreeRoot Subtree root object of the patch listener.
 * @param listener The listener function that will be called everytime a patch is generated for the object or its children.
 * @returns A disposer to stop listening to patches.
 */
export function onPatches(subtreeRoot: object, listener: OnPatchesListener): OnPatchesDisposer {
  assertTweakedObject(subtreeRoot, "subtreeRoot")
  assertIsFunction(listener, "listener")

  if (!isAction(listener)) {
    listener = action(listener.name || "onPatchesListener", listener)
  }

  let listenersForObject = patchListeners.get(subtreeRoot)
  if (!listenersForObject) {
    listenersForObject = []
    patchListeners.set(subtreeRoot, listenersForObject)
  }

  listenersForObject.push(listener)
  return () => {
    deleteFromArray(listenersForObject!, listener)
  }
}

/**
 * Adds a listener that will be called every time a patch is generated anywhere.
 * Usually prefer using `onPatches`.
 *
 * @param listener The listener function that will be called everytime a patch is generated anywhere.
 * @returns A disposer to stop listening to patches.
 */
export function onGlobalPatches(listener: OnGlobalPatchesListener): OnPatchesDisposer {
  assertIsFunction(listener, "listener")

  if (!isAction(listener)) {
    listener = action(listener.name || "onGlobalPatchesListener", listener)
  }

  globalPatchListeners.push(listener)
  return () => {
    deleteFromArray(globalPatchListeners, listener)
  }
}

function emitPatch(
  obj: object,
  patches: Patch[],
  inversePatches: Patch[],
  emitGlobally: boolean
): void {
  if (patches.length <= 0 && inversePatches.length <= 0) {
    return
  }

  // first emit global listeners
  if (emitGlobally) {
    for (let i = 0; i < globalPatchListeners.length; i++) {
      const listener = globalPatchListeners[i]
      listener(obj, patches, inversePatches)
    }
  }

  // then per subtree listeners
  const listenersForObject = patchListeners.get(obj)
  if (listenersForObject) {
    for (let i = 0; i < listenersForObject.length; i++) {
      const listener = listenersForObject[i]
      listener(patches, inversePatches)
    }
  }

  // and also emit subtree listeners all the way to the root
  const parentPath = fastGetParentPath(obj)
  if (parentPath) {
    // tweak patches so they include the child path
    const childPath = parentPath.path
    const newPatches = patches.map((p) => addPathToPatch(p, childPath))
    const newInversePatches = inversePatches.map((p) => addPathToPatch(p, childPath))

    // false to avoid emitting global patches again for the same change
    emitPatch(parentPath.parent, newPatches, newInversePatches, false)
  }
}

function addPathToPatch(patch: Patch, path: PathElement): Patch {
  return {
    ...patch,
    path: [path, ...patch.path],
  }
}
