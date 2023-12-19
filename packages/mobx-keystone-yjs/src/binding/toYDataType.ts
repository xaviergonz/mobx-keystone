import Y from "yjs"

type JSONPrimitive = string | number | boolean | null

type JSONValue = JSONPrimitive | JSONObject | JSONArray

type JSONObject = { [member: string]: JSONValue }

interface JSONArray extends Array<JSONValue> {}

function isJSONPrimitive(v: JSONValue): v is JSONPrimitive {
  const t = typeof v
  return t === "string" || t === "number" || t === "boolean" || v === null
}

function isJSONArray(v: JSONValue): v is JSONArray {
  return Array.isArray(v)
}

function isJSONObject(v: JSONValue): v is JSONObject {
  return !isJSONArray(v) && typeof v === "object"
}

export function toYDataType(v: JSONValue) {
  if (isJSONPrimitive(v)) {
    return v
  } else if (isJSONArray(v)) {
    const arr = new Y.Array()
    applyJsonArray(arr, v)
    return arr
  } else if (isJSONObject(v)) {
    const map = new Y.Map()
    applyJsonObject(map, v)
    return map
  } else {
    return undefined
  }
}

function applyJsonArray(dest: Y.Array<unknown>, source: JSONArray) {
  dest.push(source.map(toYDataType))
}

function applyJsonObject(dest: Y.Map<unknown>, source: JSONObject) {
  Object.entries(source).forEach(([k, v]) => {
    dest.set(k, toYDataType(v))
  })
}
