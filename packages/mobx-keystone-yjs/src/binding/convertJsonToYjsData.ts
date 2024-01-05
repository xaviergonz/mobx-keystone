import * as Y from "yjs"
import { JsonValue, JsonArray, JsonObject, JsonPrimitive } from "../jsonTypes"
import { YjsTextModel, yjsTextModelId } from "./YjsTextModel"
import { SnapshotOutOf } from "mobx-keystone"

function isJsonPrimitive(v: JsonValue): v is JsonPrimitive {
  const t = typeof v
  return t === "string" || t === "number" || t === "boolean" || v === null
}

function isJsonArray(v: JsonValue): v is JsonArray {
  return Array.isArray(v)
}

function isJsonObject(v: JsonValue): v is JsonObject {
  return !isJsonArray(v) && typeof v === "object"
}

/**
 * Converts a JSON value to a Y.js data structure.
 * Objects are converted to Y.Maps, arrays to Y.Arrays, primitives are untouched.
 * Frozen values are a special case and they are kept as immutable plain values.
 */
export function convertJsonToYjsData(v: JsonValue) {
  if (v === undefined || isJsonPrimitive(v)) {
    return v
  }

  if (isJsonArray(v)) {
    const arr = new Y.Array()
    applyJsonArrayToYArray(arr, v)
    return arr
  }

  if (isJsonObject(v)) {
    if (v.$frozen === true) {
      // frozen value, save as immutable object
      return v
    }

    if (v.$modelType === yjsTextModelId) {
      const text = new Y.Text()
      const yjsTextModel = v as SnapshotOutOf<YjsTextModel>
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
 */
export function applyJsonArrayToYArray(dest: Y.Array<unknown>, source: JsonArray) {
  dest.push(source.map(convertJsonToYjsData))
}

/**
 * Applies a JSON object to a Y.Map, using the convertJsonToYjsData to convert the values.
 */
export function applyJsonObjectToYMap(dest: Y.Map<unknown>, source: JsonObject) {
  Object.entries(source).forEach(([k, v]) => {
    dest.set(k, convertJsonToYjsData(v))
  })
}
