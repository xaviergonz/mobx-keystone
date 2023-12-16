import { action, isAction } from "mobx"
import { fastGetParentPath } from "../parent/path"
import type { PathElement } from "../parent/pathTypes"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction, deleteFromArray } from "../utils"
import type { Patch } from "./Patch"

const emptyPatchArray: Patch[] = []

/**
 * @internal
 */
export class InternalPatchRecorder {
  patches: Patch[] = emptyPatchArray
  invPatches: Patch[] = emptyPatchArray

  reset() {
    this.patches = emptyPatchArray
    this.invPatches = emptyPatchArray
  }

  record(patches: Patch[], invPatches: Patch[]) {
    this.patches = patches
    this.invPatches = invPatches
  }

  emit(obj: object) {
    if (this.patches.length > 0 || this.invPatches.length > 0) {
      emitGlobalPatch(obj, this.patches, this.invPatches)
      emitPatch(obj, this.patches, this.invPatches)
    }
    this.reset()
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

function emitGlobalPatch(obj: object, patches: Patch[], inversePatches: Patch[]): void {
  for (let i = 0; i < globalPatchListeners.length; i++) {
    const listener = globalPatchListeners[i]
    listener(obj, patches, inversePatches)
  }
}

function emitPatchForTarget(
  obj: object,
  patches: Patch[],
  inversePatches: Patch[],
  pathPrefix: PathElement[]
): void {
  const listenersForObject = patchListeners.get(obj)

  if (!listenersForObject || listenersForObject.length === 0) {
    return
  }

  const fixPath = (patchesArray: Patch[]) =>
    pathPrefix.length > 0 ? patchesArray.map((p) => addPathToPatch(p, pathPrefix)) : patchesArray

  const patchesWithPathPrefix = fixPath(patches)
  const invPatchesWithPathPrefix = fixPath(inversePatches)

  for (let i = 0; i < listenersForObject.length; i++) {
    const listener = listenersForObject[i]
    listener(patchesWithPathPrefix, invPatchesWithPathPrefix)
  }
}

function emitPatch(obj: object, patches: Patch[], inversePatches: Patch[]): void {
  const pathPrefix: PathElement[] = []

  emitPatchForTarget(obj, patches, inversePatches, pathPrefix)

  // and also emit subtree listeners all the way to the root
  let parentPath = fastGetParentPath(obj)
  while (parentPath) {
    pathPrefix.unshift(parentPath.path)
    emitPatchForTarget(parentPath.parent, patches, inversePatches, pathPrefix)

    parentPath = fastGetParentPath(parentPath.parent)
  }
}

function addPathToPatch(patch: Patch, pathPrefix: readonly PathElement[]): Patch {
  return {
    ...patch,
    path: [...pathPrefix, ...patch.path],
  }
}
