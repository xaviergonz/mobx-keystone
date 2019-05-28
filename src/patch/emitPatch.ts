import { Patch } from "immer"
import { getParentPath } from "../parent"
import { assertTweakedObject } from "../tweaker/core"
import { deleteFromArray } from "../utils"
import { Model } from "../model/Model"

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

export type OnPatchesListener = (patches: Patch[], inversePatches: Patch[]) => void
export type OnPatchesListenerDisposer = () => void

const patchListeners = new WeakMap<object, OnPatchesListener[]>()

export function addPatchListener(
  obj: object,
  listener: OnPatchesListener
): OnPatchesListenerDisposer {
  assertTweakedObject(obj, "addPatchListener")

  let listenersForObject = patchListeners.get(obj)
  if (!listenersForObject) {
    listenersForObject = []
    patchListeners.set(obj, listenersForObject)
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

  const parentPath = getParentPath(obj, false)
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
