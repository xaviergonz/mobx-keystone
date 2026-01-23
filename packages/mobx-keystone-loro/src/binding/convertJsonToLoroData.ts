import type { Delta } from "loro-crdt"
import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { frozenKey, isFrozenSnapshot } from "mobx-keystone"
import type { PlainArray, PlainObject, PlainPrimitive, PlainValue } from "../plainTypes"
import {
  type BindableLoroContainer,
  isBindableLoroContainer,
} from "../utils/isBindableLoroContainer"
import { isLoroTextModelSnapshot } from "./LoroTextModel"
import { isLoroContainerUpToDate, setLoroContainerSnapshot } from "./loroSnapshotTracking"

type LoroValue = BindableLoroContainer | PlainValue

/**
 * Options for applying JSON data to Loro data structures.
 */
export interface ApplyJsonToLoroOptions {
  /**
   * The mode to use when applying JSON data to Loro data structures.
   * - `add`: Creates new Loro containers for objects/arrays (default, backwards compatible)
   * - `merge`: Recursively merges values, preserving existing container references where possible
   */
  mode?: "add" | "merge"
}

function isPlainPrimitive(v: PlainValue): v is PlainPrimitive {
  const t = typeof v
  return t === "string" || t === "number" || t === "boolean" || v === null || v === undefined
}

function isPlainArray(v: PlainValue): v is PlainArray {
  return Array.isArray(v)
}

function isPlainObject(v: PlainValue): v is PlainObject {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Extracts delta array from a LoroTextModel snapshot's delta field.
 * The delta field is a frozen Delta<string>[] (array of delta operations).
 */
export function extractTextDeltaFromSnapshot(delta: unknown): Delta<string>[] {
  // The delta field is frozen, so we need to extract it
  if (isFrozenSnapshot<Delta<string>[]>(delta)) {
    const data = delta.data
    if (Array.isArray(data)) {
      return data
    }
  }

  // Handle plain delta array (not wrapped in frozen)
  if (Array.isArray(delta)) {
    return delta as Delta<string>[]
  }

  return []
}

/**
 * Applies delta operations to a LoroText using insert/mark APIs.
 * This works on both attached and detached containers.
 *
 * Strategy: Insert all text first, then apply marks. This avoids mark inheritance
 * issues when inserting at the boundary of a marked region.
 */
export function applyDeltaToLoroText(text: LoroText, deltas: Delta<string>[]): void {
  // Phase 1: Insert all text content
  let position = 0
  const markOperations: Array<{
    start: number
    end: number
    attributes: Record<string, unknown>
  }> = []

  for (const delta of deltas) {
    if (delta.insert !== undefined) {
      const content = delta.insert
      text.insert(position, content)

      // Collect mark operations to apply later
      if (delta.attributes && Object.keys(delta.attributes).length > 0) {
        markOperations.push({
          start: position,
          end: position + content.length,
          attributes: delta.attributes,
        })
      }

      position += content.length
    } else if (delta.retain) {
      position += delta.retain
    } else if (delta.delete) {
      text.delete(position, delta.delete)
    }
  }

  // Phase 2: Apply all marks after text is inserted
  for (const op of markOperations) {
    for (const [key, value] of Object.entries(op.attributes)) {
      text.mark({ start: op.start, end: op.end }, key, value)
    }
  }
}

/**
 * Converts a plain value to a Loro data structure.
 * Objects are converted to LoroMaps, arrays to LoroMovableLists, primitives are untouched.
 * Frozen values are a special case and they are kept as immutable plain values.
 */
export function convertJsonToLoroData(v: PlainValue): LoroValue {
  if (isPlainPrimitive(v)) {
    return v
  }

  if (isPlainArray(v)) {
    const list = new LoroMovableList()
    applyJsonArrayToLoroMovableList(list, v)
    return list
  }

  if (isPlainObject(v)) {
    if (v[frozenKey] === true) {
      // frozen value with explicit $frozen marker (shouldn't reach here after above check)
      return v
    }

    if (isLoroTextModelSnapshot(v)) {
      const text = new LoroText()
      // Extract delta from the snapshot and apply using insert/mark APIs
      // (applyDelta doesn't work on detached containers, but insert/mark do)
      const deltas = extractTextDeltaFromSnapshot(v.deltaList)
      if (deltas.length > 0) {
        applyDeltaToLoroText(text, deltas)
      }
      return text
    }

    const map = new LoroMap()
    applyJsonObjectToLoroMap(map, v)
    return map
  }

  throw new Error(`unsupported value type: ${v}`)
}

/**
 * Applies a JSON array to a LoroMovableList, using convertJsonToLoroData to convert the values.
 *
 * @param dest The destination LoroMovableList.
 * @param source The source JSON array.
 * @param options Options for applying the JSON data.
 */
export const applyJsonArrayToLoroMovableList = (
  dest: LoroMovableList,
  source: PlainArray,
  options: ApplyJsonToLoroOptions = {}
) => {
  const { mode = "add" } = options

  if (mode === "add") {
    // Add mode: just push all items to the end
    for (const item of source) {
      const converted = convertJsonToLoroData(item)
      if (isBindableLoroContainer(converted)) {
        dest.pushContainer(converted)
      } else {
        dest.push(converted)
      }
    }
    return
  }

  // Merge mode: recursively merge values, preserving existing container references
  // In merge mode, check if the container is already up-to-date with this snapshot
  if (isLoroContainerUpToDate(dest, source)) {
    return
  }

  // Remove extra items from the end
  const destLen = dest.length
  const srcLen = source.length
  if (destLen > srcLen) {
    dest.delete(srcLen, destLen - srcLen)
  }

  // Update existing items
  const minLen = Math.min(destLen, srcLen)
  for (let i = 0; i < minLen; i++) {
    const srcItem = source[i]
    const destItem = dest.get(i)

    // If both are objects, merge recursively
    if (isPlainObject(srcItem) && destItem instanceof LoroMap) {
      applyJsonObjectToLoroMap(destItem, srcItem, options)
      continue
    }

    // If both are arrays, merge recursively
    if (isPlainArray(srcItem) && destItem instanceof LoroMovableList) {
      applyJsonArrayToLoroMovableList(destItem, srcItem, options)
      continue
    }

    // Skip if primitive value is unchanged (optimization)
    if (isPlainPrimitive(srcItem) && destItem === srcItem) {
      continue
    }

    // Otherwise, replace the item
    dest.delete(i, 1)
    const converted = convertJsonToLoroData(srcItem)
    if (isBindableLoroContainer(converted)) {
      dest.insertContainer(i, converted)
    } else {
      dest.insert(i, converted)
    }
  }

  // Add new items at the end
  for (let i = destLen; i < srcLen; i++) {
    const converted = convertJsonToLoroData(source[i])
    if (isBindableLoroContainer(converted)) {
      dest.pushContainer(converted)
    } else {
      dest.push(converted)
    }
  }

  // Update snapshot tracking after successful merge
  setLoroContainerSnapshot(dest, source)
}

/**
 * Applies a JSON object to a LoroMap, using convertJsonToLoroData to convert the values.
 *
 * @param dest The destination LoroMap.
 * @param source The source JSON object.
 * @param options Options for applying the JSON data.
 */
export const applyJsonObjectToLoroMap = (
  dest: LoroMap,
  source: PlainObject,
  options: ApplyJsonToLoroOptions = {}
) => {
  const { mode = "add" } = options

  if (mode === "add") {
    // Add mode: just set all values
    for (const k of Object.keys(source)) {
      const v = source[k]
      if (v !== undefined) {
        const converted = convertJsonToLoroData(v)
        if (isBindableLoroContainer(converted)) {
          dest.setContainer(k, converted)
        } else {
          dest.set(k, converted)
        }
      }
    }
    return
  }

  // Merge mode: recursively merge values, preserving existing container references
  // In merge mode, check if the container is already up-to-date with this snapshot
  if (isLoroContainerUpToDate(dest, source)) {
    return
  }

  // Delete keys that are not present in source (or have undefined value)
  const sourceKeysWithValues = new Set(Object.keys(source).filter((k) => source[k] !== undefined))
  for (const key of dest.keys()) {
    if (!sourceKeysWithValues.has(key)) {
      dest.delete(key)
    }
  }

  for (const k of Object.keys(source)) {
    const v = source[k]
    // Skip undefined values - Loro maps cannot store undefined
    if (v === undefined) {
      continue
    }

    const existing = dest.get(k)

    // If source is an object and dest has a LoroMap, merge recursively
    if (isPlainObject(v) && existing instanceof LoroMap) {
      applyJsonObjectToLoroMap(existing, v, options)
      continue
    }

    // If source is an array and dest has a LoroMovableList, merge recursively
    if (isPlainArray(v) && existing instanceof LoroMovableList) {
      applyJsonArrayToLoroMovableList(existing, v, options)
      continue
    }

    // Skip if primitive value is unchanged (optimization)
    if (isPlainPrimitive(v) && existing === v) {
      continue
    }

    // Otherwise, convert and set the value (this creates new containers if needed)
    const converted = convertJsonToLoroData(v)
    if (isBindableLoroContainer(converted)) {
      dest.setContainer(k, converted)
    } else {
      dest.set(k, converted)
    }
  }

  // Update snapshot tracking after successful merge
  setLoroContainerSnapshot(dest, source)
}
