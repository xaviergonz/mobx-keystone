import { action, createAtom, IAtom, untracked } from "mobx"
import { fastGetParentPath, ParentPath } from "../parent/path"
import { debugFreeze } from "../utils"
import { SnapshotOutOf } from "./SnapshotOf"

interface SnapshotData<T extends object> {
  standard: SnapshotOutOf<T>
  readonly atom: IAtom
}

const snapshots = new WeakMap<Object, SnapshotData<any>>()

/**
 * @ignore
 * @internal
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
 * @internal
 */
export const unsetInternalSnapshot = action("unsetInternalSnapshot", (value: any) => {
  const oldSn = getInternalSnapshot(value) as SnapshotData<any>

  if (oldSn) {
    snapshots.delete(value)
    oldSn.atom.reportChanged()
  }
})

/**
 * @ignore
 * @internal
 */
export const setInternalSnapshot = action(
  "setInternalSnapshot",
  <T extends object>(value: any, standard: T): void => {
    const oldSn = getInternalSnapshot(value) as SnapshotData<any>

    // do not actually update if not needed
    if (oldSn && oldSn.standard === standard) {
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

    // also update parent(s) snapshot(s) if needed
    const parent = getInternalSnapshotParent(oldSn, fastGetParentPath(value))
    if (parent) {
      const { parentSnapshot, parentPath } = parent
      // might be false in the cases where the parent has not yet been created
      if (parentSnapshot) {
        const path = parentPath.path

        // patches for parent changes should not be emitted
        let parentStandardSn = parentSnapshot.standard
        if (parentStandardSn[path] !== sn.standard) {
          if (Array.isArray(parentStandardSn)) {
            parentStandardSn = parentStandardSn.slice()
          } else {
            parentStandardSn = Object.assign({}, parentStandardSn)
          }
          parentStandardSn[path] = sn.standard

          setInternalSnapshot(parentPath.parent, parentStandardSn)
        }
      }
    }
  }
)

/**
 * @ignore
 */
export function reportInternalSnapshotObserved(sn: Readonly<SnapshotData<any>>) {
  sn.atom.reportObserved()
}
