import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { type Patch } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import {
  type BindableLoroContainer,
  isBindableLoroContainer,
} from "../utils/isBindableLoroContainer"
import {
  applyDeltaToLoroText,
  convertJsonToLoroData,
  extractTextDeltaFromSnapshot,
} from "./convertJsonToLoroData"
import { isLoroTextModelSnapshot } from "./LoroTextModel"
import { resolveLoroPath } from "./resolveLoroPath"

/**
 * Options for applying a patch with move detection.
 */
export interface ApplyPatchOptions {
  /**
   * The previous snapshot for detecting moves (optional).
   * If provided, will attempt to use native move operations when items are rearranged.
   */
  previousSnapshot?: unknown[]
}

/**
 * Applies a mobx-keystone patch to a Loro object.
 *
 * @param loroObject The root Loro object (LoroMap or LoroText)
 * @param patch The patch to apply
 * @param options Optional options for move detection
 */
export function applyMobxKeystonePatchToLoroObject(
  loroObject: BindableLoroContainer,
  patch: Patch,
  options: ApplyPatchOptions = {}
): void {
  const { path } = patch

  if (path.length === 0) {
    failure("Cannot apply patch to root path")
  }

  // Handle LoroText as root object
  if (loroObject instanceof LoroText) {
    if (path.length > 0) {
      applyPatchToLoroText(loroObject, patch, String(path[0]))
    }
    return
  }

  // Navigate to the parent container
  const parentPath = path.slice(0, -1)
  const key = path[path.length - 1]!

  const parent =
    parentPath.length === 0 ? loroObject : resolveLoroPath(loroObject as LoroMap, parentPath)

  if (!parent) {
    // Parent doesn't exist, skip this patch
    return
  }

  if (parent instanceof LoroMap) {
    applyPatchToMap(parent, String(key), patch)
  } else if (parent instanceof LoroMovableList) {
    if (key === "length") {
      if (patch.op === "replace") {
        const newLength = Number(patch.value)
        if (newLength < parent.length) {
          parent.delete(newLength, parent.length - newLength)
        }
      }
      return
    }
    applyPatchToMovableList(parent, Number(key), patch, options)
  } else if (parent instanceof LoroText) {
    // Handle patches to LoroText properties (like deltaList)
    applyPatchToLoroText(parent, patch, String(key))
  }
}

/**
 * Applies a patch to a LoroText.
 * LoroTextModel has a `deltaList` property - handle patches to it by applying the delta to the LoroText.
 */
function applyPatchToLoroText(text: LoroText, patch: Patch, key: string): void {
  // Handle patches to deltaList field by applying the delta to the LoroText
  if (key === "deltaList" && (patch.op === "replace" || patch.op === "add")) {
    applyDeltaToText(text, patch.value)
  }
}

/**
 * Applies a delta field value to a LoroText.
 */
function applyDeltaToText(text: LoroText, deltaFieldValue: unknown): void {
  const deltas = extractTextDeltaFromSnapshot(deltaFieldValue)
  // Clear existing text first
  if (text.length > 0) {
    text.delete(0, text.length)
  }
  // Apply new delta if not empty
  if (deltas.length > 0) {
    applyDeltaToLoroText(text, deltas)
  }
}

/**
 * Applies a patch to a LoroMap.
 */
function applyPatchToMap(map: LoroMap, key: string, patch: Patch): void {
  const { op } = patch

  if (op === "remove") {
    map.delete(key)
  } else if (op === "add" || op === "replace") {
    const value = patch.value as PlainValue
    setMapValue(map, key, value)
  }
}

/**
 * Sets a value in a LoroMap, handling containers appropriately.
 */
function setMapValue(map: LoroMap, key: string, value: PlainValue): void {
  // undefined means the key should be deleted (mobx-keystone uses undefined for missing optional props)
  if (value === undefined) {
    map.delete(key)
    return
  }

  if (value === null) {
    map.set(key, null)
    return
  }

  if (typeof value !== "object") {
    map.set(key, value)
    return
  }

  // Check for LoroTextModel snapshot
  if (isLoroTextModelSnapshot(value)) {
    // Must attach the container FIRST, then apply delta (Loro limitation)
    const attachedText = map.setContainer(key, new LoroText())
    applyDeltaToText(attachedText, value.deltaList)
    return
  }

  // Convert and set container
  const converted = convertJsonToLoroData(value)
  if (isBindableLoroContainer(converted)) {
    map.setContainer(key, converted)
  } else {
    map.set(key, converted)
  }
}

/**
 * Applies a patch to a LoroMovableList.
 */
function applyPatchToMovableList(
  list: LoroMovableList,
  index: number,
  patch: Patch,
  _options: ApplyPatchOptions
): void {
  const { op } = patch

  if (op === "remove") {
    if (index >= 0 && index < list.length) {
      list.delete(index, 1)
    }
  } else if (op === "add") {
    const value = patch.value as PlainValue
    insertListValue(list, index, value)
  } else if (op === "replace") {
    const value = patch.value as PlainValue
    setListValue(list, index, value)
  }
}

/**
 * Inserts a value into a LoroMovableList.
 */
function insertListValue(list: LoroMovableList, index: number, value: PlainValue): void {
  if (value === null || value === undefined) {
    list.insert(index, null)
    return
  }

  if (typeof value !== "object") {
    list.insert(index, value)
    return
  }

  // Check for LoroTextModel snapshot
  if (isLoroTextModelSnapshot(value)) {
    // Must attach the container FIRST, then apply delta (Loro limitation)
    const attachedText = list.insertContainer(index, new LoroText())
    applyDeltaToText(attachedText, value.deltaList)
    return
  }

  // Convert and insert container
  const converted = convertJsonToLoroData(value)
  if (isBindableLoroContainer(converted)) {
    list.insertContainer(index, converted)
  } else {
    list.insert(index, converted)
  }
}

/**
 * Sets a value at an index in a LoroMovableList.
 */
function setListValue(list: LoroMovableList, index: number, value: PlainValue): void {
  if (index < 0 || index >= list.length) {
    return
  }

  if (value === null || value === undefined) {
    list.set(index, null)
    return
  }

  if (typeof value !== "object") {
    list.set(index, value)
    return
  }

  // Check for LoroTextModel snapshot
  if (isLoroTextModelSnapshot(value)) {
    // Must attach the container FIRST, then apply delta (Loro limitation)
    const attachedText = list.setContainer(index, new LoroText())
    applyDeltaToText(attachedText, value.deltaList)
    return
  }

  // Convert and set container
  const converted = convertJsonToLoroData(value)
  if (isBindableLoroContainer(converted)) {
    list.setContainer(index, converted)
  } else {
    list.set(index, converted)
  }
}
