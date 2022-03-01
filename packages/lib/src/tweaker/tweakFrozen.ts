import { Frozen, frozenKey } from "../frozen/Frozen"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { setNewInternalSnapshot } from "../snapshot/internal"
import { tweakedObjects } from "./core"
import { registerTweaker } from "./tweak"
import { TweakerPriority } from "./TweakerPriority"

/**
 * @internal
 */
export function tweakFrozen<T extends Frozen<any>>(
  frozenObj: T,
  parentPath: ParentPath<any> | undefined
): T {
  tweakedObjects.set(frozenObj, undefined)
  setParent({
    value: frozenObj,
    parentPath,
    indexChangeAllowed: false,
    isDataObject: false,
    // a frozen is not a value-type
    cloneIfApplicable: false,
  })

  // we DON'T want data proxified, but the snapshot is the data itself
  setNewInternalSnapshot(frozenObj, { [frozenKey]: true, data: frozenObj.data }, undefined, true)

  return frozenObj
}

registerTweaker(TweakerPriority.Frozen, (value, parentPath) => {
  if (value instanceof Frozen) {
    return tweakFrozen(value, parentPath)
  }
  return undefined
})
