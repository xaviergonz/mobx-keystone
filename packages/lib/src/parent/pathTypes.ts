/**
 * Property name (if the parent is an object) or index number (if the parent is an array).
 */
export type PathElement = string | number

/**
 * Path from a parent to a child.
 */
export type Path = ReadonlyArray<string | number>

/**
 * Path from a parent to a child (writable).
 */
export type WritablePath = (string | number)[]
