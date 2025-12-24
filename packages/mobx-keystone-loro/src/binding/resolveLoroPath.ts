import { LoroMap, LoroMovableList } from "loro-crdt"
import type { Path } from "mobx-keystone"
import { failure } from "../utils/error"
import { getOrCreateLoroCollectionAtom } from "../utils/getOrCreateLoroCollectionAtom"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"

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

  path.forEach((pathPart, i) => {
    if (currentLoroObject instanceof LoroMap) {
      getOrCreateLoroCollectionAtom(currentLoroObject).reportObserved()
      const key = String(pathPart)
      currentLoroObject = currentLoroObject.get(key)
    } else if (currentLoroObject instanceof LoroMovableList) {
      getOrCreateLoroCollectionAtom(currentLoroObject).reportObserved()
      const key = Number(pathPart)
      currentLoroObject = currentLoroObject.get(key)
    } else {
      throw failure(
        `LoroMap or LoroMovableList was expected at path ${JSON.stringify(
          path.slice(0, i)
        )} in order to resolve path ${JSON.stringify(path)}, but got ${currentLoroObject} instead`
      )
    }
  })

  return currentLoroObject
}
