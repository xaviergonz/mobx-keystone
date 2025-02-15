import * as Y from "yjs"
import { YjsTextModel, yjsTextModelId } from "./YjsTextModel"
import { SnapshotOutOf } from "mobx-keystone"
import { YjsData } from "./convertYjsDataToJson"
import { PlainArray, PlainObject, PlainPrimitive, PlainValue } from "../plainTypes"
import { action, runInAction } from "mobx"

function isPlainPrimitive(v: PlainValue): v is PlainPrimitive {
  const t = typeof v
  return t === "string" || t === "number" || t === "boolean" || v === null || v === undefined
}

function isPlainArray(v: PlainValue): v is PlainArray {
  return Array.isArray(v)
}

function isPlainObject(v: PlainValue): v is PlainObject {
  return !isPlainArray(v) && typeof v === "object" && v !== null
}

/**
 * Converts a plain value to a Y.js data structure.
 * Objects are converted to Y.Maps, arrays to Y.Arrays, primitives are untouched.
 * Frozen values are a special case and they are kept as immutable plain values.
 */
export function convertJsonToYjsData(v: PlainValue): YjsData {
  return runInAction(() => {
    if (isPlainPrimitive(v)) {
      return v
    }

    if (isPlainArray(v)) {
      const arr = new Y.Array()
      applyJsonArrayToYArray(arr, v)
      return arr
    }

    if (isPlainObject(v)) {
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
      return map
    }

    throw new Error(`unsupported value type: ${v}`)
  })
}

/**
 * Applies a JSON array to a Y.Array, using the convertJsonToYjsData to convert the values.
 */
export const applyJsonArrayToYArray = action((dest: Y.Array<any>, source: PlainArray) => {
  dest.push(source.map(convertJsonToYjsData))
})

/**
 * Applies a JSON object to a Y.Map, using the convertJsonToYjsData to convert the values.
 */
export const applyJsonObjectToYMap = action((dest: Y.Map<any>, source: PlainObject) => {
  Object.entries(source).forEach(([k, v]) => {
    dest.set(k, convertJsonToYjsData(v))
  })
})
