import { action, createAtom, type IAtom } from "mobx"
import { fastGetParentPath, type ParentPath } from "../parent/path"
import { invalidateCachedToSnapshotProcessorResult } from "../types/TypeChecker"
import { clonePlainObject, failure, inDevMode, isPrimitive, setOwnProp } from "../utils"
import type { PrimitiveValue } from "../utils/types"

/**
 * @internal
 */
export type SnapshotTransformFn = (sn: unknown) => unknown

interface SnapshotData {
  untransformed: any
  readonly transformFn: SnapshotTransformFn | undefined
  transformed: any
  atom: IAtom | undefined
  dirtyChildren: Set<object> | undefined
}

const snapshots = new WeakMap<object, SnapshotData>()

// true if it has been accessed publicly and therefore should be cloned
// rather than modified in place
const frozenState = new WeakMap<object, boolean>()

/**
 * @internal
 */
export function getInternalSnapshot<T extends object>(
  value: T
): Readonly<SnapshotData> | undefined {
  return snapshots.get(value)
}

/**
 * @internal
 */
export const unsetInternalSnapshot = action("unsetInternalSnapshot", (value: any) => {
  const oldSn = getInternalSnapshot(value)

  if (oldSn) {
    if (inDevMode && (oldSn.dirtyChildren?.size ?? 0) > 0) {
      throw failure("assertion failed: cannot unset an internal snapshot with dirty children")
    }
    snapshots.delete(value)
    oldSn.atom?.reportChanged()
  }
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
      dirtyChildren: undefined,
    }

    frozenState.set(untransformed, markAsFrozen)

    if (transformed !== undefined && transformed !== untransformed) {
      frozenState.set(transformed, markAsFrozen)
    }

    snapshots.set(value, sn)

    sn.atom?.reportChanged()
  }
)

type MutateInternalSnapshotFn<T> = (prevSn: T) => void

function makeSnapshotMutable(sn: SnapshotData): any {
  let untransformed = sn.untransformed
  if (frozenState.get(untransformed)) {
    untransformed = Array.isArray(untransformed)
      ? untransformed.slice()
      : clonePlainObject(untransformed)
  } else {
    invalidateCachedToSnapshotProcessorResult(untransformed)
  }
  return untransformed
}

function setSnapshotData(sn: SnapshotData, untransformed: any): void {
  const wasFrozen = frozenState.get(sn.untransformed) === true
  const transformed = sn.transformFn ? sn.transformFn(untransformed) : untransformed

  sn.untransformed = untransformed
  sn.transformed = transformed

  if (wasFrozen) {
    frozenState.set(untransformed, false)
  }
  if (
    sn.transformFn &&
    transformed !== undefined &&
    (!wasFrozen || transformed !== untransformed)
  ) {
    frozenState.set(transformed, false)
  }
}

function updateOwnSnapshot<T>(sn: SnapshotData, mutate: MutateInternalSnapshotFn<T>): void {
  const untransformed = makeSnapshotMutable(sn)
  mutate(untransformed)
  setSnapshotData(sn, untransformed)
  sn.atom?.reportChanged()
}

function updateParentSlot(parentSn: SnapshotData, path: ParentPath<any>["path"], value: any): void {
  const untransformed = makeSnapshotMutable(parentSn)
  setOwnProp(untransformed, path, value)
  setSnapshotData(parentSn, untransformed)
  parentSn.atom?.reportChanged()
}

function flushDirtyChildren(node: object, sn: SnapshotData): void {
  const dirtyChildren = sn.dirtyChildren
  if (!dirtyChildren || dirtyChildren.size === 0) {
    return
  }

  sn.dirtyChildren = undefined
  const untransformed = makeSnapshotMutable(sn)

  for (const child of dirtyChildren) {
    const childSn = snapshots.get(child)
    if (!childSn) {
      continue
    }

    flushDirtyChildren(child, childSn)
    const parentPath = fastGetParentPath(child, false)
    if (parentPath?.parent === node) {
      setOwnProp(untransformed, parentPath.path, childSn.transformed)
    }
  }

  setSnapshotData(sn, untransformed)
}

/**
 * Flushes any pending descendant snapshot updates for a node.
 *
 * @internal
 */
export function flushInternalSnapshot(value: object): void {
  const sn = snapshots.get(value)
  if (sn) {
    flushDirtyChildren(value, sn)
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

    const parentSn = snapshots.get(parentPath.parent)
    if (!parentSn) {
      return
    }

    if (parentSn.transformFn) {
      // Model output snapshot processors are part of the public mutation
      // contract. Keep their invocation eager, flushing any plain segment below
      // this model before recomputing it.
      flushDirtyChildren(child, childSn)
      flushDirtyChildren(parentPath.parent, parentSn)
      updateParentSlot(parentSn, parentPath.path, childSn.transformed)
      child = parentPath.parent
      childSn = parentSn
      continue
    }

    const wasDirty = (parentSn.dirtyChildren?.size ?? 0) > 0
    ;(parentSn.dirtyChildren ??= new Set()).add(child)
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
    flushDirtyChildren(value, sn)
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
  if (frozenState.get(newTransformed) === undefined) {
    frozenState.set(newTransformed, false)
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

  // this might be undefined if the data comes from example from transforms
  const isFrozen = frozenState.get(data)

  if (isFrozen === undefined || isFrozen) {
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

  frozenState.set(data, true)

  return data
}
