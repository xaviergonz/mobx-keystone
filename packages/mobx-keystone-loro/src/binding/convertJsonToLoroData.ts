import type { Delta } from "loro-crdt"
import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { frozenKey, isFrozenSnapshot } from "mobx-keystone"
import type { PlainArray, PlainObject, PlainPrimitive, PlainValue } from "../plainTypes"
import {
  type BindableLoroContainer,
  isBindableLoroContainer,
} from "../utils/isBindableLoroContainer"
import { isLoroTextModelSnapshot } from "./LoroTextModel"

type LoroValue = BindableLoroContainer | PlainValue

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
 */
export const applyJsonArrayToLoroMovableList = (dest: LoroMovableList, source: PlainArray) => {
  for (const item of source) {
    const converted = convertJsonToLoroData(item)
    if (isBindableLoroContainer(converted)) {
      dest.pushContainer(converted)
    } else {
      dest.push(converted)
    }
  }
}

/**
 * Applies a JSON object to a LoroMap, using convertJsonToLoroData to convert the values.
 */
export const applyJsonObjectToLoroMap = (dest: LoroMap, source: PlainObject) => {
  for (const k of Object.keys(source)) {
    const v = source[k]
    const converted = convertJsonToLoroData(v)
    if (isBindableLoroContainer(converted)) {
      dest.setContainer(k, converted)
    } else {
      dest.set(k, converted)
    }
  }
}
