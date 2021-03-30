import { isModel } from "../model/utils"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { tweakedObjects } from "./core"
import { registerTweaker } from "./tweak"
import { TweakerPriority } from "./TweakerPriority"

/**
 * @ignore
 */
export function tweakModel<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  tweakedObjects.set(value, undefined)
  setParent({
    value,
    parentPath,
    indexChangeAllowed: false,
    isDataObject: false,
    cloneIfApplicable: true,
  })

  // nothing to do for models, data is already proxified and its parent is set
  // for snapshots we will use its "$" object snapshot directly

  return value
}

registerTweaker(TweakerPriority.Model, (value, parentPath) => {
  if (isModel(value)) {
    return tweakModel(value, parentPath)
  }
  return undefined
})
