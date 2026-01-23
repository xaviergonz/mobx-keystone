import { frozenKey, modelTypeKey, SnapshotOutOf } from "mobx-keystone"
import * as Y from "yjs"
import { PlainArray, PlainObject, PlainPrimitive, PlainValue } from "../plainTypes"
import { YjsData } from "./convertYjsDataToJson"
import { YjsTextModel, yjsTextModelId } from "./YjsTextModel"
import { isYjsContainerUpToDate, setYjsContainerSnapshot } from "./yjsSnapshotTracking"

/**
 * Options for applying JSON data to Y.js data structures.
 */
export interface ApplyJsonToYjsOptions {
  /**
   * The mode to use when applying JSON data to Y.js data structures.
   * - `add`: Creates new Y.js containers for objects/arrays (default, backwards compatible)
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
 * Converts a plain value to a Y.js data structure.
 * Objects are converted to Y.Maps, arrays to Y.Arrays, primitives are untouched.
 * Frozen values are a special case and they are kept as immutable plain values.
 */
export function convertJsonToYjsData(v: PlainValue): YjsData {
  if (isPlainPrimitive(v)) {
    return v
  }

  if (isPlainArray(v)) {
    const arr = new Y.Array()
    applyJsonArrayToYArray(arr, v)
    return arr
  }

  if (isPlainObject(v)) {
    if (v[frozenKey] === true) {
      // frozen value, save as immutable object
      return v
    }

    if (v[modelTypeKey] === yjsTextModelId) {
      const text = new Y.Text()
      const yjsTextModel = v as unknown as SnapshotOutOf<YjsTextModel>
      yjsTextModel.deltaList.forEach((frozenDeltas) => {
        text.applyDelta(frozenDeltas.data)
      })
      return text
    }

    const map = new Y.Map()
    applyJsonObjectToYMap(map, v)
    return map
  }

  throw new Error(`unsupported value type: ${v}`)
}

/**
 * Applies a JSON array to a Y.Array, using the convertJsonToYjsData to convert the values.
 *
 * @param dest The destination Y.Array.
 * @param source The source JSON array.
 * @param options Options for applying the JSON data.
 */
export const applyJsonArrayToYArray = (
  dest: Y.Array<any>,
  source: PlainArray,
  options: ApplyJsonToYjsOptions = {}
) => {
  const { mode = "add" } = options

  // In merge mode, check if the container is already up-to-date with this snapshot
  if (mode === "merge" && isYjsContainerUpToDate(dest, source)) {
    return
  }

  const srcLen = source.length

  if (mode === "add") {
    // Add mode: just push all items to the end
    for (let i = 0; i < srcLen; i++) {
      dest.push([convertJsonToYjsData(source[i])])
    }
    return
  }

  // Merge mode: recursively merge values, preserving existing container references
  const destLen = dest.length

  // Remove extra items from the end
  if (destLen > srcLen) {
    dest.delete(srcLen, destLen - srcLen)
  }

  // Update existing items
  const minLen = Math.min(destLen, srcLen)
  for (let i = 0; i < minLen; i++) {
    const srcItem = source[i]
    const destItem = dest.get(i)

    // If both are objects, merge recursively
    if (isPlainObject(srcItem) && destItem instanceof Y.Map) {
      applyJsonObjectToYMap(destItem, srcItem, options)
      continue
    }

    // If both are arrays, merge recursively
    if (isPlainArray(srcItem) && destItem instanceof Y.Array) {
      applyJsonArrayToYArray(destItem, srcItem, options)
      continue
    }

    // Skip if primitive value is unchanged (optimization)
    if (isPlainPrimitive(srcItem) && destItem === srcItem) {
      continue
    }

    // Otherwise, replace the item
    dest.delete(i, 1)
    dest.insert(i, [convertJsonToYjsData(srcItem)])
  }

  // Add new items at the end
  for (let i = destLen; i < srcLen; i++) {
    dest.push([convertJsonToYjsData(source[i])])
  }

  // Update snapshot tracking after successful merge
  setYjsContainerSnapshot(dest, source)
}

/**
 * Applies a JSON object to a Y.Map, using the convertJsonToYjsData to convert the values.
 *
 * @param dest The destination Y.Map.
 * @param source The source JSON object.
 * @param options Options for applying the JSON data.
 */
export const applyJsonObjectToYMap = (
  dest: Y.Map<any>,
  source: PlainObject,
  options: ApplyJsonToYjsOptions = {}
) => {
  const { mode = "add" } = options

  // In merge mode, check if the container is already up-to-date with this snapshot
  if (mode === "merge" && isYjsContainerUpToDate(dest, source)) {
    return
  }

  if (mode === "add") {
    // Add mode: just set all values
    for (const k of Object.keys(source)) {
      const v = source[k]
      if (v !== undefined) {
        dest.set(k, convertJsonToYjsData(v))
      }
    }
    return
  }

  // Merge mode: recursively merge values, preserving existing container references

  // Delete keys that are not present in source (or have undefined value)
  const sourceKeysWithValues = new Set(Object.keys(source).filter((k) => source[k] !== undefined))
  for (const key of dest.keys()) {
    if (!sourceKeysWithValues.has(key)) {
      dest.delete(key)
    }
  }

  for (const k of Object.keys(source)) {
    const v = source[k]
    // Skip undefined values - Y.js maps cannot store undefined
    if (v === undefined) {
      continue
    }

    const existing = dest.get(k)

    // If source is an object and dest has a Y.Map, merge recursively
    if (isPlainObject(v) && existing instanceof Y.Map) {
      applyJsonObjectToYMap(existing, v, options)
      continue
    }

    // If source is an array and dest has a Y.Array, merge recursively
    if (isPlainArray(v) && existing instanceof Y.Array) {
      applyJsonArrayToYArray(existing, v, options)
      continue
    }

    // Skip if primitive value is unchanged (optimization)
    if (isPlainPrimitive(v) && existing === v) {
      continue
    }

    // Otherwise, convert and set the value (this creates new containers if needed)
    dest.set(k, convertJsonToYjsData(v))
  }

  // Update snapshot tracking after successful merge
  setYjsContainerSnapshot(dest, source)
}
