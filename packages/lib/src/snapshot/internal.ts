import { action, createAtom, IAtom, untracked } from "mobx"
import { fastGetParentPath, ParentPath } from "../parent/path"
import { debugFreeze, failure, inDevMode } from "../utils"

/**
 * @ignore
 * @internal
 */
export type SnapshotTransformFn = (sn: unknown) => unknown

interface SnapshotData {
  untransformed: any
  transformFn: SnapshotTransformFn | undefined
  transformed: any
  readonly atom: IAtom
}

const snapshots = new WeakMap<Object, SnapshotData>()

/**
 * @ignore
 * @internal
 */
export function getInternalSnapshot<T extends object>(
  value: T
): Readonly<SnapshotData> | undefined {
  return snapshots.get(value) as any
}

function getInternalSnapshotParent(
  sn: Readonly<SnapshotData> | undefined,
  parentPath: ParentPath<any> | undefined
): { parentSnapshot: SnapshotData; parentPath: ParentPath<any> } | undefined {
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
  const oldSn = getInternalSnapshot(value)

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
  <T extends object>(
    value: any,
    untransformed: T,
    transformFn: SnapshotTransformFn | undefined
  ): void => {
    const oldSn = getInternalSnapshot(value)

    // do not actually update if not needed
    if (oldSn && oldSn.untransformed === untransformed) {
      return
    }

    debugFreeze(untransformed)

    let sn: SnapshotData
    if (oldSn) {
      if (inDevMode() && transformFn) {
        throw failure(
          "assertion error: a transform function cannot be set when we are updating an old internal snapshot"
        )
      }

      sn = oldSn
      sn.untransformed = untransformed
      sn.transformed = sn.transformFn ? sn.transformFn(untransformed) : untransformed
    } else {
      sn = {
        untransformed,
        transformFn,
        transformed: transformFn ? transformFn(untransformed) : untransformed,
        atom: createAtom("snapshot"),
      }

      snapshots.set(value, sn)
    }

    if (sn.untransformed !== sn.transformed) {
      debugFreeze(sn.transformed)
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
        let parentUntransformedSn = parentSnapshot.untransformed
        if (parentUntransformedSn[path] !== sn.transformed) {
          if (Array.isArray(parentUntransformedSn)) {
            parentUntransformedSn = parentUntransformedSn.slice()
          } else {
            parentUntransformedSn = Object.assign({}, parentUntransformedSn)
          }
          parentUntransformedSn[path] = sn.transformed

          setInternalSnapshot(parentPath.parent, parentUntransformedSn, undefined)
        }
      }
    }
  }
)

/**
 * @ignore
 */
export function reportInternalSnapshotObserved(sn: Readonly<SnapshotData>) {
  sn.atom.reportObserved()
}
