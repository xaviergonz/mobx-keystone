import { LoroMap, LoroMovableList } from "loro-crdt"
import type { Path } from "mobx-keystone"
import { failure } from "../utils/error"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"
import { reportLoroCollectionObserved } from "../utils/loroCollectionAtoms"

/**
 * Resolves a path within a Loro object structure.
 * Returns the Loro container at the specified path.
 *
 * @param loroObject The root Loro object
 * @param path Array of keys/indices to traverse
 * @returns The Loro container at the path
 */
export function resolveLoroPath(loroObject: BindableLoroContainer, path: Path): unknown {
  let currentLoroObject: unknown = loroObject

  // Every applied change resolves its path, so avoid a callback per traversal.
  for (let i = 0; i < path.length; i++) {
    if (currentLoroObject instanceof LoroMap) {
      const key = String(path[i])
      reportLoroCollectionObserved(loroObject, currentLoroObject, key)
      currentLoroObject = currentLoroObject.get(key)
    } else if (currentLoroObject instanceof LoroMovableList) {
      reportLoroCollectionObserved(loroObject, currentLoroObject)
      currentLoroObject = currentLoroObject.get(Number(path[i]))
    } else {
      throw failure(
        `LoroMap or LoroMovableList was expected at path ${JSON.stringify(
          path.slice(0, i)
        )} in order to resolve path ${JSON.stringify(path)}, but got ${currentLoroObject} instead`
      )
    }
  }

  return currentLoroObject
}
