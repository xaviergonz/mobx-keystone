import type { ContainerID, LoroDoc, LoroEvent, LoroText } from "loro-crdt"
import { type Patch, type Path, toFrozenSnapshot, type WritablePath } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"
import { convertLoroDataToJson } from "./convertLoroDataToJson"

/**
 * Converts a single Loro event to mobx-keystone patches.
 *
 * @param event The Loro event
 * @param loroDoc The Loro document (needed to get containers by ID for text delta)
 * @param rootLoroContainerId The container ID of the root Loro map (to strip from paths)
 * @returns Array of mobx-keystone patches
 */
export function convertLoroEventToPatches(
  event: LoroEvent,
  loroDoc: LoroDoc,
  rootLoroContainerId: ContainerID
): Patch[] {
  const patches: Patch[] = []

  const rootPath = loroDoc.getPathToContainer(rootLoroContainerId)
  if (!rootPath) {
    return patches
  }

  const path = resolveEventPath(event.path, rootPath)
  if (path === undefined) {
    return patches
  }

  const diff = event.diff
  if (diff.type === "map") {
    // Map changes
    for (const [key, value] of Object.entries(diff.updated)) {
      if (value === undefined) {
        // Key was deleted
        patches.push({
          op: "remove",
          path: [...path, key],
        })
      } else {
        // Key was added or updated
        patches.push({
          op: "replace",
          path: [...path, key],
          value: convertLoroDataToJson(value as BindableLoroContainer | PlainValue),
        })
      }
    }
  } else if (diff.type === "list") {
    // List changes (MovableList uses list diff type)
    let index = 0
    for (const delta of diff.diff) {
      if ("retain" in delta && delta.retain !== undefined) {
        index += delta.retain
      } else if ("insert" in delta && delta.insert !== undefined) {
        for (const item of delta.insert) {
          patches.push({
            op: "add",
            path: [...path, index],
            value: convertLoroDataToJson(item as BindableLoroContainer | PlainValue),
          })
          index++
        }
      } else if ("delete" in delta && delta.delete !== undefined) {
        for (let i = 0; i < delta.delete; i++) {
          patches.push({
            op: "remove",
            path: [...path, index],
          })
        }
      }
    }
  } else if (diff.type === "text") {
    // Text changes - emit the delta as a replace
    // The path should point to the `deltaList` property of the LoroTextModel
    // event.target is a container ID string, so we need to get the actual container
    const textContainer = loroDoc.getContainerById(event.target) as LoroText | undefined
    if (textContainer) {
      patches.push({
        op: "replace",
        path: [...path, "deltaList"],
        value: toFrozenSnapshot(textContainer.toDelta()),
      })
    }
  }

  return patches
}

/**
 * Resolves the path from a Loro event to a mobx-keystone path.
 * The event path is the path from the doc root to the container that emitted the event.
 * We need to strip the path of our root container to get a path relative to our bound object.
 */
function resolveEventPath(eventPath: Path, rootPath: Path): WritablePath | undefined {
  if (eventPath.length < rootPath.length) {
    return undefined
  }

  for (let i = 0; i < rootPath.length; i++) {
    if (eventPath[i] !== rootPath[i]) {
      return undefined
    }
  }

  return eventPath.slice(rootPath.length) as WritablePath
}
