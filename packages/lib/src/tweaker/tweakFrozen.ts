import { Frozen, frozenKey } from "../frozen/Frozen"
import { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { setInternalSnapshot } from "../snapshot/internal"
import { tweakedObjects } from "./core"

/**
 * @ingore
 */
export function tweakFrozen<T extends Frozen<any>>(
  frozenObj: T,
  parentPath: ParentPath<any> | undefined
): T {
  tweakedObjects.set(frozenObj, undefined)
  setParent(frozenObj, parentPath, false, false)

  // we DON'T want data proxified, but the snapshot is the data itself
  setInternalSnapshot(frozenObj, { [frozenKey]: true, data: frozenObj.data })

  return frozenObj as any
}
