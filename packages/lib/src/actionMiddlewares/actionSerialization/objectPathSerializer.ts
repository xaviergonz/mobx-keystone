import { fastGetRootPath, resolvePathCheckingIds } from "../../parent/path"
import { Path } from "../../parent/pathTypes"
import { isTweakedObject } from "../../tweaker/core"
import { failure } from "../../utils"
import { rootPathToTargetPathIds } from "../utils"
import { ActionCallArgumentSerializer, cannotSerialize } from "./core"

interface ObjectPath {
  targetPath: Path
  targetPathIds: (string | null)[]
}

export const objectPathSerializer: ActionCallArgumentSerializer<object, ObjectPath> = {
  id: "mobx-keystone/objectPath",

  serialize(value, _, targetRoot) {
    if (typeof value !== "object" || value === null || !isTweakedObject(value, false))
      return cannotSerialize

    // try to serialize a ref to its path if possible instead
    if (targetRoot) {
      const rootPath = fastGetRootPath(value)
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
      if (result.resolved) {
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
