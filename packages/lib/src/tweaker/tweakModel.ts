import { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { tweakedObjects } from "./core"

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
