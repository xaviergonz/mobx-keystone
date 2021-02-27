import { isModel } from "../model/utils"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { tweakedObjects } from "./core"
import { registerTweaker } from "./tweak"

/**
 * @ignore
 */
export function tweakModel<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  tweakedObjects.set(value, undefined)
  setParent(value, parentPath, false, false)

  // nothing to do for models, data is already proxified and its parent is set
  // for snapshots we will use its "$" object snapshot directly

  return value
}

registerTweaker(2, (value, parentPath) => {
  if (isModel(value)) {
    return tweakModel(value, parentPath)
  }
  return undefined
})
