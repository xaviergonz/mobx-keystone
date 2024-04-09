export type JsonPrimitiveWithUndefined = string | number | boolean | null | undefined
export type JsonValueWithUndefined =
  | JsonPrimitiveWithUndefined
  | JsonObjectWithUndefined
  | JsonArrayWithUndefined
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type JsonObjectWithUndefined = { [key: string]: JsonValueWithUndefined }
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JsonArrayWithUndefined extends Array<JsonValueWithUndefined> {}
