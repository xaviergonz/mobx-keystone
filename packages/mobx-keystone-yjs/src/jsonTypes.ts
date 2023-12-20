export type JSONPrimitive = string | number | boolean | null
export type JSONValue = JSONPrimitive | JSONObject | JSONArray
export type JSONObject = { [key: string]: JSONValue }
export interface JSONArray extends Array<JSONValue> {}
