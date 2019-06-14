import { Patch } from "immer"
import { action, isAction } from "mobx"
import { Model } from "../model/Model"
import { getParentPath } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"
import { deleteFromArray, failure } from "../utils"

export class PatchRecorder {
  patches!: Patch[]
  invPatches!: Patch[]

  constructor() {
    this.record = this.record.bind(this)
  }

  record(patches: Patch[], invPatches: Patch[]) {
    this.patches = patches
    this.invPatches = invPatches
  }

  emit(obj: object) {
    emitPatch(obj, this.patches, this.invPatches)
  }
}

/**
 * A function that gets called when a patch is emitted.
 */
export type OnPatchesListener = (patches: Patch[], inversePatches: Patch[]) => void

/**
 * Disposer function to stop listening to patches.
 */
export type OnPatchesListenerDisposer = () => void

const patchListeners = new WeakMap<object, OnPatchesListener[]>()

/**
 * Adds a listener that will be called every time a patch is generated for the tree of the given target object.
 *
 * @param target Root object of the patch listener.
 * @param listener The listener function that will be called everytime a patch is generated for the object or its children.
 * @returns A disposer to stop listening to patches.
 */
export function onPatches(target: object, listener: OnPatchesListener): OnPatchesListenerDisposer {
  assertTweakedObject(target, "onPatches")

  if (typeof listener !== "function") {
    throw failure("listener must be a function")
  }

  let listenersForObject = patchListeners.get(target)
  if (!listenersForObject) {
    listenersForObject = []
    patchListeners.set(target, listenersForObject)
  }

  if (!isAction(listener)) {
    listener = action(listener.name || "onPatchesListener", listener)
  }

  listenersForObject.push(listener)
  return () => {
    deleteFromArray(listenersForObject!, listener)
  }
}

function emitPatch(obj: object, patches: Patch[], inversePatches: Patch[]): void {
  if (patches.length <= 0 && inversePatches.length <= 0) {
    return
  }

  const listenersForObject = patchListeners.get(obj)
  if (listenersForObject) {
    listenersForObject.forEach(listener => listener(patches, inversePatches))
  }

  const parentPath = getParentPath(obj)
  if (parentPath) {
    // tweak patches so they include the child path
    const childPath = parentPath.path
    const parentIsModel = parentPath.parent instanceof Model
    const newPatches = parentIsModel ? patches : patches.map(p => addPathToPatch(p, childPath))
    const newInversePatches = parentIsModel
      ? inversePatches
      : inversePatches.map(p => addPathToPatch(p, childPath))
    emitPatch(parentPath.parent, newPatches, newInversePatches)
  }
}

function addPathToPatch(patch: Patch, path: string): Patch {
  return {
    ...patch,
    path: [path, ...patch.path],
  }
}
