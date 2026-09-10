/**
 * A JSON primitive value, as stored in a CRDT binding snapshot.
 */
export type PlainPrimitive = string | number | boolean | null | undefined

/**
 * Any JSON value, as stored in a CRDT binding snapshot.
 */
export type PlainValue = PlainPrimitive | PlainObject | PlainArray

/**
 * A JSON object, as stored in a CRDT binding snapshot.
 */
export type PlainObject = { [key: string]: PlainValue }

/**
 * A JSON array, as stored in a CRDT binding snapshot.
 */
export interface PlainArray extends Array<PlainValue> {}
