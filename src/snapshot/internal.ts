import produce from "immer"
import { createAtom, IAtom, transaction } from "mobx"
import { getParentPath, ParentPath } from "../parent"
import { debugFreeze } from "../utils"

interface SnapshotData<T extends object> {
  standard: T
  pureJson: T
  readonly atom: IAtom
}

const snapshots = new WeakMap<Object, SnapshotData<any>>()

export function getInternalSnapshot<T extends object>(
  value: T
): Readonly<SnapshotData<T>> | undefined {
  return snapshots.get(value) as any
}

function getInternalSnapshotParent(
  sn: SnapshotData<any>,
  parentPath: ParentPath<any> | undefined
): { parentSnapshot: SnapshotData<any>; parentPath: ParentPath<any> } | undefined {
  if (!parentPath) {
    return undefined
  }

  const parentSn = getInternalSnapshot(parentPath.parent)
  if (!parentSn) {
    return undefined
  }

  if (sn === parentSn) {
    // linked snapshot, skip
    return getInternalSnapshotParent(parentSn, getParentPath(parentPath.parent, false))
  }

  return sn
    ? {
        parentSnapshot: parentSn,
        parentPath: parentPath,
      }
    : undefined
}

export function setInternalSnapshot<T extends object>(value: any, standard: T, pureJson: T) {
  const oldSn = getInternalSnapshot(value) as SnapshotData<any>

  // do not actually update if not needed
  if (oldSn && oldSn.standard === standard && oldSn.pureJson === pureJson) {
    return
  }

  debugFreeze(standard)
  debugFreeze(pureJson)

  let sn: SnapshotData<any>
  if (oldSn) {
    sn = oldSn
    sn.standard = standard
    sn.pureJson = pureJson
  } else {
    sn = {
      standard,
      pureJson,
      atom: createAtom("snapshot"),
    }

    snapshots.set(value, sn)
  }

  transaction(() => {
    sn.atom.reportChanged()

    // also update parent(s) snapshot(s) if needed
    const parent = getInternalSnapshotParent(oldSn, getParentPath(value, false))
    if (parent) {
      const { parentSnapshot, parentPath } = parent
      // might be false in the cases where the parent has not yet been created
      if (parentSnapshot) {
        const path = parentPath.path

        let parentStandard: any, parentPureJson: any
        parentStandard = produce(parentSnapshot.standard, (draftStandard: any) => {
          parentPureJson = produce(parentSnapshot.pureJson, (draftPureJson: any) => {
            draftStandard[path] = sn.standard
            draftPureJson[path] = sn.pureJson
          })
        })

        setInternalSnapshot(parentPath.parent, parentStandard, parentPureJson)
      }
    }
  })
}

export function linkInternalSnapshot(value: object, snapshot: Readonly<SnapshotData<any>>) {
  snapshots.set(value, snapshot)
}

export function unlinkInternalSnapshot(value: object) {
  return snapshots.delete(value)
}

export function reportInternalSnapshotObserved(sn: Readonly<SnapshotData<any>>) {
  sn.atom.reportObserved()
}
