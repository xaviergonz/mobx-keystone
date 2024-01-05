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

export function applyJsonArrayToYArray(dest: Y.Array<unknown>, source: JsonArray) {
  dest.push(source.map(convertJsonToYjsData))
}

export function applyJsonObjectToYMap(dest: Y.Map<unknown>, source: JsonObject) {
  Object.entries(source).forEach(([k, v]) => {
    dest.set(k, convertJsonToYjsData(v))
  })
}
