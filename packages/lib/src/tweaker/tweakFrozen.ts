import { Frozen, frozenKey } from "../frozen/Frozen"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { setInternalSnapshot } from "../snapshot/internal"
import { tweakedObjects } from "./core"
import { registerTweaker } from "./tweak"

/**
 * @ignore
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

registerTweaker(5, (value, parentPath) => {
  if ((value as any) instanceof Frozen) {
    return tweakFrozen(value as Frozen<any>, parentPath)
  }
  return undefined
})
