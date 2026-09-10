import {
  isUnchangedSubtree,
  jsonEquals,
  noPreviousValue,
  type PreviousValue,
  previousObjectValue,
} from "@mobx-keystone/crdt-binding-common"
import type { Delta } from "loro-crdt"
import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { frozenKey, isFrozenSnapshot } from "mobx-keystone"
import type { PlainArray, PlainObject, PlainPrimitive, PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import {
  type BindableLoroContainer,
  isBindableLoroContainer,
} from "../utils/isBindableLoroContainer"
import { isLoroTextModelSnapshot } from "./LoroTextModel"

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

/** Merges compatible values without replacing their containers. */
function mergeLoroValue(
  dest: unknown,
  source: PlainValue,
  options: ApplyJsonToLoroOptions,
  previous: PreviousValue
): boolean {
  if (isFrozenSnapshot(source)) {
    return isFrozenSnapshot(dest) && jsonEquals(dest, source)
  }

  if (isPlainObject(source)) {
    if (isLoroTextModelSnapshot(source)) {
      if (dest instanceof LoroText) {
        replaceLoroTextDelta(dest, extractTextDeltaFromSnapshot(source.deltaList))
        return true
      }
    } else if (dest instanceof LoroMap) {
      applyJsonObjectToLoroMapInternal(dest, source, options, previous)
      return true
    }
  } else if (isPlainArray(source) && dest instanceof LoroMovableList) {
    applyJsonArrayToLoroMovableListInternal(dest, source, options, previous)
    return true
  }
  return (
    isPlainPrimitive(source) && (dest === source || (Number.isNaN(dest) && Number.isNaN(source)))
  )
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
  let pendingText: string[] = []
  const flushText = () => {
    if (pendingText.length === 0) {
      return
    }
    const content = pendingText.join("")
    text.insert(position - content.length, content)
    pendingText = []
  }
  const markOperations: Array<{
    start: number
    end: number
    attributes: Record<string, unknown>
  }> = []

  for (const delta of deltas) {
    if (delta.insert !== undefined) {
      const content = delta.insert
      if (content.length === 0) {
        continue
      }
      pendingText.push(content)

      // Collect mark operations to apply later
      if (delta.attributes && Object.keys(delta.attributes).length > 0) {
        markOperations.push({
          start: position,
          end: position + content.length,
          attributes: delta.attributes,
        })
      }

      position += content.length
    } else {
      flushText()
      if (delta.retain) {
        position += delta.retain
      } else if (delta.delete) {
        text.delete(position, delta.delete)
      }
    }
  }
  flushText()

  // Phase 2: Apply all marks after text is inserted
  for (const op of markOperations) {
    for (const [key, value] of Object.entries(op.attributes)) {
      text.mark({ start: op.start, end: op.end }, key, value)
    }
  }
}

/**
 * Replaces text contents only when the delta has changed.
 * @internal
 */
export function replaceLoroTextDelta(text: LoroText, deltas: Delta<string>[]): void {
  const current = text.toDelta()
  if (jsonEquals(current, deltas)) {
    return
  }
  // Equivalent insert spans may be split differently or carry empty attributes.
  // Normalize only when the text matches; ordinary content edits keep the fast path.
  if (
    deltas.every((delta) => delta.insert !== undefined) &&
    deltas.map((delta) => delta.insert).join("") === text.toString()
  ) {
    const normalized = new LoroText()
    applyDeltaToLoroText(normalized, deltas)
    if (jsonEquals(current, normalized.toDelta())) return
  }
  if (text.length > 0) {
    text.delete(0, text.length)
  }
  applyDeltaToLoroText(text, deltas)
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

  throw failure(`unsupported value type: ${v}`)
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
  applyJsonArrayToLoroMovableListInternal(dest, source, options, noPreviousValue)
}

function applyJsonArrayToLoroMovableListInternal(
  dest: LoroMovableList,
  source: PlainArray,
  options: ApplyJsonToLoroOptions,
  previous: PreviousValue
) {
  const { mode = "add" } = options

  if (mode === "merge" && isUnchangedSubtree(previous, source)) {
    return
  }

  if (source.includes(undefined)) {
    throw failure("undefined values are not supported in Loro lists")
  }

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
  // Remove extra items from the end
  const destLen = dest.length
  const srcLen = source.length
  if (destLen > srcLen) {
    dest.delete(srcLen, destLen - srcLen)
  }

  // Update existing items
  const minLen = Math.min(destLen, srcLen)
  const existingItems = minLen > 0 ? dest.toArray() : []
  for (let i = 0; i < minLen; i++) {
    const srcItem = source[i]
    const destItem = existingItems[i]

    // Positions inside a list may already have been realigned before this walk
    // (see reconcileLoroModelOrder), so an element's previous snapshot is no
    // longer addressable by index. Children of a list are always re-walked.
    if (mergeLoroValue(destItem, srcItem, options, noPreviousValue)) {
      continue
    }

    // Replace the value while preserving the list item identity for concurrent moves.
    const converted = convertJsonToLoroData(srcItem)
    if (isBindableLoroContainer(converted)) {
      dest.setContainer(i, converted)
    } else {
      dest.set(i, converted)
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
  applyJsonObjectToLoroMapInternal(dest, source, options, noPreviousValue)
}

function applyJsonObjectToLoroMapInternal(
  dest: LoroMap,
  source: PlainObject,
  options: ApplyJsonToLoroOptions,
  previous: PreviousValue
) {
  const { mode = "add" } = options

  if (mode === "merge" && isUnchangedSubtree(previous, source)) {
    return
  }

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
  // Delete keys that are not present in source (or have undefined value)
  for (const key of dest.keys()) {
    if (!Object.hasOwn(source, key) || source[key] === undefined) {
      dest.delete(key)
    }
  }

  const previousObject = previousObjectValue(previous)

  for (const k of Object.keys(source)) {
    const v = source[k]
    // Skip undefined values - Loro maps cannot store undefined
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

    if (mergeLoroValue(existing, v, options, previousValue)) {
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
}

/**
 * Merges a snapshot into the Loro container that represents it, preserving
 * existing container references where possible.
 *
 * `previousSnapshot` is the snapshot the container currently holds, when it is
 * known. Subtrees that `snapshot` shares with it by reference are already in
 * place and are skipped instead of being read back and compared key by key.
 * @internal
 */
export function applySnapshotToLoroContainer(
  container: unknown,
  snapshot: unknown,
  previousSnapshot: PreviousValue = noPreviousValue
): void {
  const options: ApplyJsonToLoroOptions = { mode: "merge" }
  if (container instanceof LoroMap) {
    applyJsonObjectToLoroMapInternal(container, snapshot as PlainObject, options, previousSnapshot)
  } else if (container instanceof LoroMovableList) {
    applyJsonArrayToLoroMovableListInternal(
      container,
      snapshot as PlainArray,
      options,
      previousSnapshot
    )
  } else if (container instanceof LoroText) {
    const textSnapshot = snapshot as Record<string, unknown>
    if (isLoroTextModelSnapshot(textSnapshot as PlainObject)) {
      replaceLoroTextDelta(container, extractTextDeltaFromSnapshot(textSnapshot.deltaList))
    }
  }
}
