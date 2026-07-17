import { action, createAtom, type IAtom } from "mobx"
import { fastGetParentPath } from "../parent/path"
import type { PathElement } from "../parent/pathTypes"
import { getOrCreateTreeNodeMetadata, treeNodeMetadata } from "../tweaker/treeNodeMetadata"
import { invalidateCachedToSnapshotProcessorResult } from "../types/TypeChecker"
import { clonePlainObject, failure, inDevMode, isPrimitive, setProtoProp } from "../utils"
import type { PrimitiveValue } from "../utils/types"

/**
 * @internal
 */
export type SnapshotTransformFn = (sn: unknown) => unknown

/** @internal */
export interface SnapshotData {
  untransformed: any
  readonly transformFn: SnapshotTransformFn | undefined
  transformed: any
  atom: IAtom | undefined
  // Source of truth for copy-on-write of this snapshot's untransformed data.
  untransformedFrozen: boolean
  dirtyChild: object | undefined
  dirtyChildSnapshot: SnapshotData | undefined
  dirtyChildPath: PathElement | undefined
  additionalDirtyChildren: Map<object, DirtyChild> | undefined
  isUnset: boolean
}

interface DirtyChild {
  readonly snapshot: SnapshotData
  readonly path: PathElement
}

// `false` means the generic freezer must traverse this raw value; `true` means
// it is frozen; a SnapshotData value means it is mutable and its frozen state
// must be reflected back into that owner. `undefined` is either external /
// untracked data or a fused frozen clone, whose owner tracks its state directly.
const snapshotStates = new WeakMap<object, boolean | SnapshotData>()

/**
 * @internal
 */
export function getInternalSnapshot<T extends object>(
  value: T
): Readonly<SnapshotData> | undefined {
  return treeNodeMetadata.get(value)?.snapshot
}

/**
 * @internal
 */
export const unsetInternalSnapshot = action("unsetInternalSnapshot", (value: any) => {
  const metadata = treeNodeMetadata.get(value)
  if (!metadata) {
    return
  }

  const oldSn = metadata.snapshot
  if (!oldSn) {
    return
  }

  if (inDevMode && oldSn.dirtyChild !== undefined) {
    throw failure("assertion failed: cannot unset an internal snapshot with dirty children")
  }
  oldSn.isUnset = true
  if (snapshotStates.get(oldSn.untransformed) === oldSn) {
    // Preserve the former frozen-state tracking after dropping the owner.
    snapshotStates.set(oldSn.untransformed, false)
  }
  metadata.snapshot = undefined
  oldSn.atom?.reportChanged()
})

/**
 * @internal
 */
export const setNewInternalSnapshot = action(
  "setNewInternalSnapshot",
  <T extends object>(
    value: any,
    untransformed: T,
    transformFn: SnapshotTransformFn | undefined,
    markAsFrozen = false
  ): void => {
    const transformed: any = transformFn ? transformFn(untransformed) : untransformed

    const sn: SnapshotData = {
      untransformed,
      transformFn,
      transformed,
      atom: undefined, // will be created when first observed
      untransformedFrozen: markAsFrozen,
      dirtyChild: undefined,
      dirtyChildSnapshot: undefined,
      dirtyChildPath: undefined,
      additionalDirtyChildren: undefined,
      isUnset: false,
    }

    snapshotStates.set(untransformed, markAsFrozen ? true : sn)

    if (transformed !== undefined && transformed !== untransformed) {
      snapshotStates.set(transformed, markAsFrozen)
    }

    getOrCreateTreeNodeMetadata(value).snapshot = sn

    sn.atom?.reportChanged()
  }
)

type MutateInternalSnapshotFn<T> = (prevSn: T) => void

function makeSnapshotMutable(sn: SnapshotData): any {
  let untransformed = sn.untransformed
  if (sn.untransformedFrozen) {
    untransformed = Array.isArray(untransformed)
      ? untransformed.slice()
      : clonePlainObject(untransformed)
  } else {
    invalidateCachedToSnapshotProcessorResult(untransformed)
  }
  return untransformed
}

function setSnapshotData(sn: SnapshotData, untransformed: any, freezeIfCloned = false): void {
  // `makeSnapshotMutable` returns a new container exactly when this snapshot
  // was frozen. All callers obtain `untransformed` through that helper.
  const wasFrozen = untransformed !== sn.untransformed
  const transformed = sn.transformFn ? sn.transformFn(untransformed) : untransformed

  sn.untransformed = untransformed
  sn.transformed = transformed

  const keepFrozen = freezeIfCloned && wasFrozen && !sn.transformFn
  sn.untransformedFrozen = keepFrozen
  if (wasFrozen && !keepFrozen) {
    snapshotStates.set(untransformed, sn)
  }
  if (
    sn.transformFn &&
    transformed !== undefined &&
    (!wasFrozen || transformed !== untransformed)
  ) {
    snapshotStates.set(transformed, false)
  }
}

function updateOwnSnapshot<T>(sn: SnapshotData, mutate: MutateInternalSnapshotFn<T>): void {
  const untransformed = makeSnapshotMutable(sn)
  mutate(untransformed)
  setSnapshotData(sn, untransformed)
  sn.atom?.reportChanged()
}

function updateParentSlot(parentSn: SnapshotData, path: PathElement, value: any): void {
  const untransformed = makeSnapshotMutable(parentSn)
  if (path === "__proto__") {
    setProtoProp(untransformed, value)
  } else {
    untransformed[path] = value
  }
  setSnapshotData(parentSn, untransformed)
  parentSn.atom?.reportChanged()
}

function flushDirtyChild(
  node: object,
  untransformed: any,
  child: object,
  childSn: SnapshotData,
  childPath: PathElement,
  freezeAfterFlush: boolean,
  freezeClonedContainer: boolean
): void {
  if (childSn.isUnset) {
    return
  }

  if (inDevMode) {
    const currentParentPath = fastGetParentPath(child, false)
    if (currentParentPath?.parent !== node || currentParentPath.path !== childPath) {
      throw failure("assertion failed: dirty child parent path changed before flush")
    }
  }

  const childIsFrozen = flushDirtyChildren(child, childSn, freezeAfterFlush)
  if (freezeClonedContainer && !childIsFrozen) {
    freezeInternalSnapshot(childSn.transformed)
  }
  // The overwhelmingly common snapshot path is a normal property or array
  // index. Keep the `__proto__` safe-definition behavior for the exceptional
  // key without paying its helper call on every observed ancestor flush.
  if (childPath === "__proto__") {
    setProtoProp(untransformed, childSn.transformed)
  } else {
    untransformed[childPath] = childSn.transformed
  }
}

function flushDirtyChildren(node: object, sn: SnapshotData, freezeAfterFlush: boolean): boolean {
  const dirtyChild = sn.dirtyChild
  const dirtyChildSnapshot = sn.dirtyChildSnapshot
  const dirtyChildPath = sn.dirtyChildPath
  if (!dirtyChild || !dirtyChildSnapshot || dirtyChildPath === undefined) {
    return false
  }

  const additionalDirtyChildren = sn.additionalDirtyChildren
  sn.dirtyChild = undefined
  sn.dirtyChildSnapshot = undefined
  sn.dirtyChildPath = undefined
  sn.additionalDirtyChildren = undefined
  const untransformed = makeSnapshotMutable(sn)
  const freezeClonedContainer =
    freezeAfterFlush && untransformed !== sn.untransformed && !sn.transformFn

  flushDirtyChild(
    node,
    untransformed,
    dirtyChild,
    dirtyChildSnapshot,
    dirtyChildPath,
    freezeAfterFlush,
    freezeClonedContainer
  )
  additionalDirtyChildren?.forEach((dirtyChild, child) => {
    flushDirtyChild(
      node,
      untransformed,
      child,
      dirtyChild.snapshot,
      dirtyChild.path,
      freezeAfterFlush,
      freezeClonedContainer
    )
  })

  setSnapshotData(sn, untransformed, freezeClonedContainer)
  return freezeClonedContainer
}

/**
 * Flushes any pending descendant snapshot updates for a node.
 *
 * @internal
 */
export function flushInternalSnapshot(value: object, freezeAfterFlush: boolean): void {
  const sn = treeNodeMetadata.get(value)?.snapshot
  if (sn) {
    flushDirtyChildren(value, sn, freezeAfterFlush)
  }
}

function updateAncestorSnapshots(value: object, sn: SnapshotData): void {
  let child = value
  let childSn = sn

  while (true) {
    const parentPath = fastGetParentPath(child, false)
    if (!parentPath) {
      return
    }

    const parentSn = treeNodeMetadata.get(parentPath.parent)?.snapshot
    if (!parentSn) {
      return
    }

    if (parentSn.transformFn) {
      // Model output snapshot processors are part of the public mutation
      // contract. Keep their invocation eager, flushing any plain segment below
      // this model before recomputing it.
      flushDirtyChildren(child, childSn, false)
      flushDirtyChildren(parentPath.parent, parentSn, false)
      updateParentSlot(parentSn, parentPath.path, childSn.transformed)
      child = parentPath.parent
      childSn = parentSn
      continue
    }

    const wasDirty = parentSn.dirtyChild !== undefined
    if (!wasDirty) {
      parentSn.dirtyChild = child
      parentSn.dirtyChildSnapshot = childSn
      parentSn.dirtyChildPath = parentPath.path
    } else if (parentSn.dirtyChild !== child) {
      ;(parentSn.additionalDirtyChildren ??= new Map()).set(child, {
        snapshot: childSn,
        path: parentPath.path,
      })
    }
    parentSn.atom?.reportChanged()
    if (wasDirty) {
      return
    }

    child = parentPath.parent
    childSn = parentSn
  }
}

/**
 * @internal
 */
export const updateInternalSnapshot = action(
  "updateInternalSnapshot",
  <T extends object>(value: any, mutate: MutateInternalSnapshotFn<T>): void => {
    const sn = getInternalSnapshot(value)! as SnapshotData
    flushDirtyChildren(value, sn, false)
    updateOwnSnapshot(sn, mutate)
    updateAncestorSnapshots(value, sn)
  }
)

/**
 * @internal
 */
export const refreshInternalSnapshot = action("refreshInternalSnapshot", (value: any): void => {
  const sn = getInternalSnapshot(value) as SnapshotData | undefined
  if (!sn?.transformFn) {
    return
  }

  const oldTransformed = sn.transformed
  const newTransformed: any = sn.transformFn(sn.untransformed)

  if (oldTransformed === newTransformed) {
    return
  }

  sn.transformed = newTransformed

  // transformed snapshots created by internal transforms must be tracked as mutable
  // until they are exposed through getSnapshot / freezeInternalSnapshot.
  if (snapshotStates.get(newTransformed) === undefined) {
    snapshotStates.set(newTransformed, false)
  }

  sn.atom?.reportChanged()
  updateAncestorSnapshots(value, sn)
})

/**
 * @internal
 */
export function reportInternalSnapshotObserved(sn: SnapshotData) {
  if (!sn.atom) {
    sn.atom = createAtom("snapshot")
  }
  sn.atom.reportObserved()
}

/**
 * @internal
 */
export function freezeInternalSnapshot<T extends PrimitiveValue | object>(data: T): T {
  if (isPrimitive(data)) {
    return data
  }

  // `undefined` means external/untracked data (for example, from a transform).
  // For a tracked frozen value, all reachable tracked descendants were frozen
  // first, so returning early here preserves snapshot immutability.
  const state = snapshotStates.get(data)

  if (state === undefined || state === true) {
    // already frozen or an external data (e.g. from a transform)
    return data
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      freezeInternalSnapshot(data[i])
    }
  } else {
    const keys = Object.keys(data)
    for (let i = 0; i < keys.length; i++) {
      freezeInternalSnapshot((data as any)[keys[i]])
    }
  }

  snapshotStates.set(data, true)

  if (typeof state === "object" && state.untransformed === data) {
    state.untransformedFrozen = true
  }

  return data
}
