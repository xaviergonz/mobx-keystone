import { Frozen, frozenKey } from "../frozen/Frozen"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { setNewInternalSnapshot } from "../snapshot/internal"
import { markAsTweakedObject } from "./treeNodeMetadata"
import { registerTweaker } from "./tweak"
import { TweakerPriority } from "./TweakerPriority"

/**
 * @internal
 */
export function tweakFrozen<T extends Frozen<any>>(
  frozenObj: T,
  parentPath: ParentPath<any> | undefined
): T {
  markAsTweakedObject(frozenObj)
  setParent(
    frozenObj, // value
    parentPath,
    false, // isDataObject
    // a frozen is not a value-type
    false // cloneIfApplicable
  )

  // we DON'T want data proxified, but the snapshot is the data itself
  setNewInternalSnapshot(frozenObj, { [frozenKey]: true, data: frozenObj.data }, undefined, true)

  return frozenObj
}

/**
 * @internal
 */
export function registerFrozenTweaker() {
  registerTweaker(TweakerPriority.Frozen, (value, parentPath) => {
    if (value instanceof Frozen) {
      return tweakFrozen(value, parentPath)
    }
    return undefined
  })
}
