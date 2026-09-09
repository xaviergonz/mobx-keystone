import { getSnapshotModelTypeAndId, modelTypeKey } from "mobx-keystone"
import * as Y from "yjs"
import { yjsTextModelId } from "./YjsTextModel"

/**
 * Check only edited paths before combining local writes with pending native data.
 * @internal
 */
export function hasYjsModelIdentityConflict(
  container: unknown,
  snapshot: unknown,
  path: readonly (string | number)[]
): boolean {
  for (let depth = 0; ; depth++) {
    const model = getSnapshotModelTypeAndId(snapshot)
    if (model) {
      if (model.modelType === yjsTextModelId) {
        if (!(container instanceof Y.Text)) return true
      } else if (
        !(container instanceof Y.Map) ||
        container.get(modelTypeKey) !== model.modelType ||
        (model.modelIdPropertyName !== undefined &&
          container.get(model.modelIdPropertyName) !== model.modelId)
      )
        return true
    }
    if (depth === path.length || snapshot === null || typeof snapshot !== "object") return false
    const key = path[depth]
    snapshot = (snapshot as Record<string | number, unknown>)[key]
    container =
      container instanceof Y.Map
        ? container.get(String(key))
        : container instanceof Y.Array &&
            typeof key === "number" &&
            key >= 0 &&
            key < container.length
          ? container.get(key)
          : undefined
  }
}
