import { isModel } from "../model/utils"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { tweakedObjects } from "./core"
import { registerTweaker } from "./tweak"
import { TweakerPriority } from "./TweakerPriority"

/**
 * @internal
 */
export function tweakModel<T extends object>(value: T, parentPath: ParentPath<any> | undefined): T {
  tweakedObjects.set(value, undefined)
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
