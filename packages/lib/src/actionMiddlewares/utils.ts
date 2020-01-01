import { isModel } from "../model/utils"
import { RootPath } from "../parent/path"
import { Path } from "../parent/pathTypes"

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

/**
 * @ignore
 */
export function pathToTargetPathIds(root: any, path: Path): (string | null)[] {
  const targetPathIds: (string | null)[] = []
  let current = root // we don't care about the root ID

  for (let i = 0; i < path.length; i++) {
    current = current[path[i]]
    const targetObjId = isModel(current) ? current.$modelId : null
    targetPathIds.push(targetObjId)
  }

  return targetPathIds
}
