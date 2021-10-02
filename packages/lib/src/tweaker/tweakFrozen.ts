import { Frozen, frozenKey } from "../frozen/Frozen"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { setInternalSnapshot } from "../snapshot/internal"
import { tweakedObjects } from "./core"
import { registerTweaker } from "./tweak"
import { TweakerPriority } from "./TweakerPriority"

/**
 * @ignore
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
  setInternalSnapshot(frozenObj, { [frozenKey]: true, data: frozenObj.data }, undefined)

  return frozenObj as any
}

registerTweaker(TweakerPriority.Frozen, (value, parentPath) => {
  if ((value as any) instanceof Frozen) {
    return tweakFrozen(value as Frozen<any>, parentPath)
  }
  return undefined
})
