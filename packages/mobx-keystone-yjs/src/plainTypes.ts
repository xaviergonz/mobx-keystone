export type PlainPrimitive = string | number | boolean | null | undefined

export type PlainValue = PlainPrimitive | PlainObject | PlainArray

export type PlainObject = { [key: string]: PlainValue }

export interface PlainArray extends Array<PlainValue> {}
