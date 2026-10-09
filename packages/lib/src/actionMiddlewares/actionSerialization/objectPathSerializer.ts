import { fastGetRootPath, resolvePathCheckingIds } from "../../parent/path"
import type { Path } from "../../parent/pathTypes"
import { isTreeNode, isTweakedObject } from "../../tweaker/core"
import { failure, namespace } from "../../utils"
import { rootPathToTargetPathIds } from "../utils"
import { type ActionCallArgumentSerializer, cannotSerialize } from "./core"

interface ObjectPath {
  targetPath: Path
  targetPathIds: (string | null)[]
}

export const objectPathSerializer: ActionCallArgumentSerializer<object, ObjectPath> = {
  id: `${namespace}/objectPath`,

  serialize(value, _, targetRoot) {
    if (typeof value !== "object" || value === null || !isTweakedObject(value, false)) {
      return cannotSerialize
    }

    // try to serialize a ref to its path if possible instead
    if (targetRoot) {
      const rootPath = fastGetRootPath(value, false)
      if (rootPath.root === targetRoot) {
        return {
          targetPath: rootPath.path,
          targetPathIds: rootPathToTargetPathIds(rootPath),
        } as ObjectPath
      }
    }

    return cannotSerialize
  },

  deserialize(ref, _, targetRoot) {
    // try to resolve the node back
    if (targetRoot) {
      const result = resolvePathCheckingIds(targetRoot, ref.targetPath, ref.targetPathIds)
      // only tree nodes can be serialized as paths, so anything else is not a valid target
      if (result.resolved && isTreeNode(result.value)) {
        return result.value
      }
    }

    throw failure(
      `object at path ${JSON.stringify(ref.targetPath)} with ids ${JSON.stringify(
        ref.targetPathIds
      )} could not be resolved`
    )
  },
}
