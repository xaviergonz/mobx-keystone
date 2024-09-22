export type JsonPrimitiveWithUndefined = string | number | boolean | null | undefined;

export type JsonValueWithUndefined =
  | JsonPrimitiveWithUndefined
  | JsonObjectWithUndefined
  | JsonArrayWithUndefined;

export type JsonObjectWithUndefined = { [key: string]: JsonValueWithUndefined };

export interface JsonArrayWithUndefined extends Array<JsonValueWithUndefined> {}
