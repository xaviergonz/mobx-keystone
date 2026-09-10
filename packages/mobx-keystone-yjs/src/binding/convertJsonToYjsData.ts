import {
  isUnchangedSubtree,
  jsonEquals,
  noPreviousValue,
  type PreviousValue,
  previousObjectValue,
} from "@mobx-keystone/crdt-binding-common"
import { frozenKey, modelTypeKey, type SnapshotOutOf } from "mobx-keystone"
import * as Y from "yjs"
import type { PlainArray, PlainObject, PlainPrimitive, PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import type { YjsData } from "./convertYjsDataToJson"
import { replaceYjsText, type TextDeltaHistory } from "./textDelta"
import { type YjsTextModel, yjsTextModelId } from "./YjsTextModel"

/**
 * Options for applying JSON data to Y.js data structures.
 */
export interface ApplyJsonToYjsOptions {
  /**
   * The mode to use when applying JSON data to Y.js data structures.
   * - `add`: Creates new Y.js containers for objects/arrays (default, backwards compatible)
   * - `merge`: Recursively merges values, preserving existing container references where possible.
   *   The destination must be attached to a Y.Doc so its contents can be read.
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

function isMapSnapshot(v: PlainValue): v is PlainObject {
  return isPlainObject(v) && v[frozenKey] !== true && v[modelTypeKey] !== yjsTextModelId
}

function isTextSnapshot(v: PlainValue): v is PlainObject {
  return isPlainObject(v) && v[frozenKey] !== true && v[modelTypeKey] === yjsTextModelId
}

/** Y.Text is edited in place: replacing it would invalidate relative positions. */
function mergeTextSnapshot(existing: unknown, source: PlainValue): boolean {
  if (!isTextSnapshot(source) || !(existing instanceof Y.Text)) {
    return false
  }
  replaceYjsText(existing, (source as unknown as SnapshotOutOf<YjsTextModel>).deltaList)
  return true
}

// Frozen snapshots are atomic values, not maps. Avoid replacing unchanged values.
function isUnchangedAtomicValue(existing: unknown, source: PlainValue): boolean {
  if (!isPlainObject(source)) {
    return Object.is(existing, source)
  }
  if (source[frozenKey] === true) {
    return jsonEquals(existing, source)
  }
  return false
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

  throw failure(`unsupported value type: ${v}`)
}

function appendJsonItems(dest: Y.Array<any>, source: PlainArray, start: number) {
  // Detached Y.Arrays spread their input into a native array. Bound each batch
  // to avoid the engine's argument limit while keeping insertion work bulked.
  const batchSize = 8192
  for (let i = start; i < source.length; i += batchSize) {
    dest.push(source.slice(i, i + batchSize).map(convertJsonToYjsData))
  }
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
  const apply = () => applyJsonArrayToYArrayInternal(dest, source, options, noPreviousValue)
  if (dest.doc) {
    dest.doc.transact(apply)
  } else {
    if (options.mode === "merge") {
      throw failure("the merge destination must be attached to a document")
    }
    apply()
  }
}

function applyJsonArrayToYArrayInternal(
  dest: Y.Array<any>,
  source: PlainArray,
  options: ApplyJsonToYjsOptions,
  previous: PreviousValue
) {
  const { mode = "add" } = options

  if (mode === "merge" && isUnchangedSubtree(previous, source)) {
    return
  }

  if (source.includes(undefined)) {
    throw failure("undefined values are not supported in Yjs arrays")
  }
  const srcLen = source.length

  if (mode === "add") {
    // Add mode: just push all items to the end
    appendJsonItems(dest, source, 0)
    return
  }

  // Merge mode: recursively merge values, preserving existing container references
  const destLen = dest.length

  // Remove extra items from the end
  if (destLen > srcLen) {
    dest.delete(srcLen, destLen - srcLen)
  }

  // Update existing items. Positions inside a list may already have been
  // realigned before this walk (see reconcileYjsContainerPositions), so an
  // element's previous snapshot is no longer addressable by index: children of
  // a list are always re-walked.
  const minLen = Math.min(destLen, srcLen)
  // Indexed Y.Array reads can repeatedly scan contiguous shared items, even
  // with search markers. Capture retained values in one linear traversal.
  const existingItems = minLen > 0 ? dest.toArray() : []
  let replacements: YjsData[] = []
  const flushReplacements = (end: number) => {
    if (replacements.length === 0) return
    const start = end - replacements.length
    dest.delete(start, replacements.length)
    dest.insert(start, replacements)
    replacements = []
  }
  for (let i = 0; i < minLen; i++) {
    const srcItem = source[i]
    const destItem = existingItems[i]

    // Retained containers and unchanged values separate replacement runs.
    if (isMapSnapshot(srcItem) && destItem instanceof Y.Map) {
      flushReplacements(i)
      applyJsonObjectToYMapInternal(destItem, srcItem, options, noPreviousValue)
      continue
    }

    if (isPlainArray(srcItem) && destItem instanceof Y.Array) {
      flushReplacements(i)
      applyJsonArrayToYArrayInternal(destItem, srcItem, options, noPreviousValue)
      continue
    }

    if (isTextSnapshot(srcItem) && destItem instanceof Y.Text) {
      flushReplacements(i)
      mergeTextSnapshot(destItem, srcItem)
      continue
    }

    if (isUnchangedAtomicValue(destItem, srcItem)) {
      flushReplacements(i)
      continue
    }

    // Bound the buffer while replacing adjacent values in bulk, avoiding
    // repeated Yjs searches and item splitting for every replaced element.
    replacements.push(convertJsonToYjsData(srcItem))
    if (replacements.length === 8192) flushReplacements(i + 1)
  }
  flushReplacements(minLen)

  // Add new items at the end
  appendJsonItems(dest, source, destLen)
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
  const apply = () => applyJsonObjectToYMapInternal(dest, source, options, noPreviousValue)
  if (dest.doc) {
    dest.doc.transact(apply)
  } else {
    if (options.mode === "merge") {
      throw failure("the merge destination must be attached to a document")
    }
    apply()
  }
}

function applyJsonObjectToYMapInternal(
  dest: Y.Map<any>,
  source: PlainObject,
  options: ApplyJsonToYjsOptions,
  previous: PreviousValue
) {
  const { mode = "add" } = options

  if (mode === "merge" && isUnchangedSubtree(previous, source)) {
    return
  }

  const sourceKeys = Object.keys(source)

  if (mode === "add") {
    // Add mode: just set all values
    for (const k of sourceKeys) {
      const v = source[k]
      if (v !== undefined) {
        dest.set(k, convertJsonToYjsData(v))
      }
    }
    return
  }

  // Merge mode: recursively merge values, preserving existing container references

  // Delete keys that are not present in source (or have undefined value)
  for (const key of dest.keys()) {
    if (!Object.hasOwn(source, key) || source[key] === undefined) {
      dest.delete(key)
    }
  }

  const previousObject = previousObjectValue(previous)

  for (const k of sourceKeys) {
    const v = source[k]
    // Omit undefined values to match JSON object serialization.
    if (v === undefined) {
      continue
    }

    const previousValue: PreviousValue =
      previousObject && Object.hasOwn(previousObject, k) ? previousObject[k] : noPreviousValue

    // An unchanged subtree is already in place, whatever its kind.
    if (isUnchangedSubtree(previousValue, v)) {
      continue
    }

    const existing = dest.get(k)

    // If source is an object and dest has a Y.Map, merge recursively
    if (isMapSnapshot(v) && existing instanceof Y.Map) {
      applyJsonObjectToYMapInternal(existing, v, options, previousValue)
      continue
    }

    // If source is an array and dest has a Y.Array, merge recursively
    if (isPlainArray(v) && existing instanceof Y.Array) {
      applyJsonArrayToYArrayInternal(existing, v, options, previousValue)
      continue
    }

    // Edit an existing Y.Text in place rather than replacing the container
    if (mergeTextSnapshot(existing, v)) {
      continue
    }

    // Skip unchanged primitive and frozen values
    if (isUnchangedAtomicValue(existing, v)) {
      continue
    }

    // Otherwise, convert and set the value (this creates new containers if needed)
    dest.set(k, convertJsonToYjsData(v))
  }
}

/**
 * Merges a snapshot into the Yjs container that represents it, preserving
 * existing container references where possible.
 *
 * `previousSnapshot` is the snapshot the container currently holds, when it is
 * known. Subtrees that `snapshot` shares with it by reference are already in
 * place and are skipped instead of being read back and compared key by key.
 * @internal
 */
export function applySnapshotToYjsContainer(
  container: unknown,
  snapshot: unknown,
  previousSnapshot: PreviousValue = noPreviousValue
): void {
  if (container instanceof Y.Text) {
    replaceYjsText(container, (snapshot as { deltaList: TextDeltaHistory }).deltaList)
    return
  }

  if (!(container instanceof Y.Map || container instanceof Y.Array)) {
    return
  }
  if (!container.doc) {
    throw failure("the merge destination must be attached to a document")
  }

  const options: ApplyJsonToYjsOptions = { mode: "merge" }
  let apply: () => void
  if (container instanceof Y.Map) {
    apply = () =>
      applyJsonObjectToYMapInternal(container, snapshot as PlainObject, options, previousSnapshot)
  } else {
    apply = () =>
      applyJsonArrayToYArrayInternal(container, snapshot as PlainArray, options, previousSnapshot)
  }
  container.doc.transact(apply)
}
