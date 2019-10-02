import { isModel } from "../model/utils"
import { RootPath } from "../parent/path"

/**
 * @ignore
 */
export function rootPathToTargetPathIds(rootPath: RootPath<any>): (string | null)[] {
  const targetPathIds: (string | null)[] = []

  for (let i = 0; i < rootPath.path.length; i++) {
    const targetObj = rootPath.pathObjects[i + 1] // first is root, we don't care about its ID
    const targetObjId = isModel(targetObj) ? targetObj.$modelId : null
    targetPathIds.push(targetObjId)
  }

  return targetPathIds
}
