import { modelIdKey } from "../model/metadata"
import { isModel } from "../model/utils"
import type { RootPath } from "../parent/path"
import type { Path } from "../parent/pathTypes"

/**
 * @internal
 */
export function rootPathToTargetPathIds(rootPath: RootPath<any>): (string | null)[] {
  const targetPathIds: (string | null)[] = []

  for (let i = 0; i < rootPath.path.length; i++) {
    const targetObj = rootPath.pathObjects[i + 1] // first is root, we don't care about its ID
    const targetObjId = isModel(targetObj) ? targetObj[modelIdKey] ?? null : null
    targetPathIds.push(targetObjId)
  }

  return targetPathIds
}

/**
 * @internal
 */
export function pathToTargetPathIds(root: any, path: Path): (string | null)[] {
  const targetPathIds: (string | null)[] = []
  let current = root // we don't care about the root ID

  for (let i = 0; i < path.length; i++) {
    current = current[path[i]]
    const targetObjId = isModel(current) ? current[modelIdKey] ?? null : null
    targetPathIds.push(targetObjId)
  }

  return targetPathIds
}
