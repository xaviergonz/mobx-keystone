import * as Y from "yjs"
import { failure } from "../utils/error"
import { getOrCreateYjsCollectionAtom } from "../utils/getOrCreateYjsCollectionAtom"

export function resolveYjsPath(yjsObject: unknown, path: readonly (string | number)[]): unknown {
  let currentYjsObject: unknown = yjsObject

  path.forEach((pathPart, i) => {
    if (currentYjsObject instanceof Y.Map) {
      getOrCreateYjsCollectionAtom(currentYjsObject).reportObserved()
      const key = String(pathPart)
      currentYjsObject = currentYjsObject.get(key)
    } else if (currentYjsObject instanceof Y.Array) {
      getOrCreateYjsCollectionAtom(currentYjsObject).reportObserved()
      const key = Number(pathPart)
      currentYjsObject = currentYjsObject.get(key)
    } else {
      throw failure(
        `Y.Map or Y.Array was expected at path ${JSON.stringify(
          path.slice(0, i)
        )} in order to resolve path ${JSON.stringify(path)}, but got ${currentYjsObject} instead`
      )
    }
  })

  return currentYjsObject
}
