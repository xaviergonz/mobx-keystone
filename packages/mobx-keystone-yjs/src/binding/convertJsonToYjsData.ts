import * as Y from "yjs"
import { YjsTextModel, yjsTextModelId } from "./YjsTextModel"
import { SnapshotOutOf } from "mobx-keystone"
import { YjsData } from "./convertYjsDataToJson"
import {
  JsonArrayWithUndefined,
  JsonObjectWithUndefined,
  JsonPrimitiveWithUndefined,
  JsonValueWithUndefined,
} from "jsonTypes"

function isJsonPrimitiveWithUndefined(v: JsonValueWithUndefined): v is JsonPrimitiveWithUndefined {
  const t = typeof v
  return t === "string" || t === "number" || t === "boolean" || v === null || v === undefined
}

function isJsonArrayWithUndefined(v: JsonValueWithUndefined): v is JsonArrayWithUndefined {
  return Array.isArray(v)
}

function isJsonObjectWithUndefined(v: JsonValueWithUndefined): v is JsonObjectWithUndefined {
  return !isJsonArrayWithUndefined(v) && typeof v === "object"
}

/**
 * Converts a JSON value to a Y.js data structure.
 * Objects are converted to Y.Maps, arrays to Y.Arrays, primitives are untouched.
 * Frozen values are a special case and they are kept as immutable plain values.
 */
export function convertJsonToYjsData(v: JsonValueWithUndefined | undefined): YjsData {
  if (v === undefined || isJsonPrimitiveWithUndefined(v)) {
    return v
  }

  if (isJsonArrayWithUndefined(v)) {
    const arr = new Y.Array()
    applyJsonArrayToYArray(arr, v)
    return arr as YjsData
  }

  if (isJsonObjectWithUndefined(v)) {
    if (v.$frozen === true) {
      // frozen value, save as immutable object
      return v
    }

    if (v.$modelType === yjsTextModelId) {
      const text = new Y.Text()
      const yjsTextModel = v as unknown as SnapshotOutOf<YjsTextModel>
      yjsTextModel.deltaList.forEach((frozenDeltas) => {
        text.applyDelta(frozenDeltas.data)
      })
      return text
    }

    const map = new Y.Map()
    applyJsonObjectToYMap(map, v)
    return map as YjsData
  }

  throw new Error(`unsupported value type: ${v}`)
}

/**
 * Applies a JSON array to a Y.Array, using the convertJsonToYjsData to convert the values.
 */
export function applyJsonArrayToYArray(dest: Y.Array<unknown>, source: JsonArrayWithUndefined) {
  dest.push(source.map(convertJsonToYjsData))
}

/**
 * Applies a JSON object to a Y.Map, using the convertJsonToYjsData to convert the values.
 */
export function applyJsonObjectToYMap(dest: Y.Map<unknown>, source: JsonObjectWithUndefined) {
  Object.entries(source).forEach(([k, v]) => {
    dest.set(k, convertJsonToYjsData(v))
  })
}
