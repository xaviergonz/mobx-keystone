import { isModel } from "../model/utils"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { TweakerPriority } from "./TweakerPriority"
import { markAsTweakedObject } from "./treeNodeMetadata"
import { registerTweaker } from "./tweak"

/**
 * @internal
 */
export function tweakModel<T extends object>(value: T, parentPath: ParentPath<any> | undefined): T {
  markAsTweakedObject(value)
  setParent(
    value,
    parentPath,
    false, // indexChangeAllowed
    false, // isDataObject
    true // cloneIfApplicable
  )

  // nothing to do for models, data is already proxified and its parent is set
  // for snapshots we will use its "$" object snapshot directly

  return value
}

/**
 * @internal
 */
export function registerModelTweaker() {
  registerTweaker(TweakerPriority.Model, (value, parentPath) => {
    if (isModel(value)) {
      return tweakModel(value, parentPath)
    }
    return undefined
  })
}
