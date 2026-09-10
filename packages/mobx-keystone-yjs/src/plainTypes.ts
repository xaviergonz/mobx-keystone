// Keep these types local so published declarations do not depend on the private common package.
export type PlainPrimitive = string | number | boolean | null | undefined

export type PlainValue = PlainPrimitive | PlainObject | PlainArray

export type PlainObject = { [key: string]: PlainValue }

export interface PlainArray extends Array<PlainValue> {}
