import { action, createAtom, IAtom, untracked } from "mobx"
import { getParentPath, ParentPath } from "../parent/path"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { debugFreeze, failure, inDevMode } from "../utils"
import { SnapshotOutOf } from "./SnapshotOf"

interface SnapshotData<T extends object> {
  standard: SnapshotOutOf<T>
  readonly atom: IAtom
}

const snapshots = new WeakMap<Object, SnapshotData<any>>()

/**
 * @ignore
 */
export function getInternalSnapshot<T extends object>(
  value: T
): Readonly<SnapshotData<T>> | undefined {
  return snapshots.get(value) as any
}

function getInternalSnapshotParent(
  sn: SnapshotData<any>,
  parentPath: ParentPath<any> | undefined
): { parentSnapshot: SnapshotData<any>; parentPath: ParentPath<any> } | undefined {
  return untracked(() => {
    if (!parentPath) {
      return undefined
    }

    const parentSn = getInternalSnapshot(parentPath.parent)
    if (!parentSn) {
      return undefined
    }

    if (sn === parentSn) {
      // linked snapshot, skip
      return getInternalSnapshotParent(parentSn, getParentPath(parentPath.parent))
    }

    return sn
      ? {
          parentSnapshot: parentSn,
          parentPath: parentPath,
        }
      : undefined
  })
}

/**
 * @ignore
 */
export const setInternalSnapshot = action(
  "setInternalSnapshot",
  <T extends object>(
    value: any,
    standard: T,
    patchRecorder: InternalPatchRecorder | undefined
  ): void => {
    const oldSn = getInternalSnapshot(value) as SnapshotData<any>

    // do not actually update if not needed
    if (oldSn && oldSn.standard === standard) {
      if (inDevMode()) {
        if (
          patchRecorder &&
          (patchRecorder.patches.length > 0 || patchRecorder.invPatches.length > 0)
        ) {
          throw failure(
            "assertion error: the snapshot did not change yet there were patches generated"
          )
        }
      }
      return
    }

    debugFreeze(standard)

    let sn: SnapshotData<any>
    if (oldSn) {
      sn = oldSn
      sn.standard = standard
    } else {
      sn = {
        standard,
        atom: createAtom("snapshot"),
      }

      snapshots.set(value, sn)
    }

    sn.atom.reportChanged()

    if (patchRecorder) {
      patchRecorder.emit(value)
    }

    // also update parent(s) snapshot(s) if needed
    const parent = getInternalSnapshotParent(oldSn, getParentPath(value))
    if (parent) {
      const { parentSnapshot, parentPath } = parent
      // might be false in the cases where the parent has not yet been created
      if (parentSnapshot) {
        const path = parentPath.path

        // patches for parent changes should not be emitted
        let parentStandardSn = parentSnapshot.standard
        if (parentStandardSn[path] !== sn.standard) {
          parentStandardSn = Object.assign({}, parentStandardSn)
          parentStandardSn[path] = sn.standard

          setInternalSnapshot(parentPath.parent, parentStandardSn, undefined)
        }
      }
    }
  }
)

/**
 * @ignore
 */
export function linkInternalSnapshot(value: object, snapshot: Readonly<SnapshotData<any>>) {
  snapshots.set(value, snapshot)
}

/**
 * @ignore
 */
export function unlinkInternalSnapshot(value: object) {
  return snapshots.delete(value)
}

/**
 * @ignore
 */
export function reportInternalSnapshotObserved(sn: Readonly<SnapshotData<any>>) {
  sn.atom.reportObserved()
}
