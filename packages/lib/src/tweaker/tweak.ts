import { action } from "mobx"
import { getObjectChildren } from "../parent/coreObjectChildren"
import { fastGetParent, ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { unsetInternalSnapshot } from "../snapshot/internal"
import { failure, inDevMode, isMap, isObject, isPrimitive, isSet } from "../utils"
import { isTweakedObject, tweakedObjects } from "./core"

/**
 * Turns an object (array, plain object) into a tree node,
 * which then can accept calls to `getParent`, `getSnapshot`, etc.
 * If a tree node is passed it will return the passed argument directly.
 *
 * @param value Object to turn into a tree node.
 * @returns The object as a tree node.
 */
export function toTreeNode<T extends object>(value: T): T {
  if (!isObject(value)) {
    throw failure("only objects can be turned into tree nodes")
  }

  if (!isTweakedObject(value, true)) {
    return tweak(value, undefined)
  }
  return value
}

/**
 * @ignore
 * @internal
 */
export type Tweaker<T> = (value: T, parentPath: ParentPath<any> | undefined) => T | undefined

const tweakers: { priority: number; tweaker: Tweaker<any> }[] = []

/**
 * @ignore
 * @internal
 */
export function registerTweaker<T>(priority: number, tweaker: Tweaker<T>): void {
  tweakers.push({ priority, tweaker })
  tweakers.sort((a, b) => a.priority - b.priority)
}

function internalTweak<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  if (isPrimitive(value)) {
    return value
  }

  // already tweaked
  if (isTweakedObject(value as any, true)) {
    setParent(value, parentPath, false, false)
    return value
  }

  const tweakersLen = tweakers.length
  for (let i = 0; i < tweakersLen; i++) {
    const { tweaker } = tweakers[i]
    const tweakedVal = tweaker(value, parentPath)
    if (tweakedVal !== undefined) {
      return tweakedVal
    }
  }

  // unsupported
  if (isMap(value)) {
    throw failure(
      "maps are not directly supported. consider applying 'transformObjectAsMap' over a '{[k: string]: V}' property, or 'transformArrayAsMap' over a '[string, V][]' property instead."
    )
  }

  // unsupported
  if (isSet(value)) {
    throw failure(
      "sets are not directly supported. consider applying 'transformArrayAsSet' over a 'V[]' property instead."
    )
  }

  throw failure(
    `tweak can only work over models, observable objects/arrays, or primitives, but got ${value} instead`
  )
}

/**
 * @ignore
 * @internal
 */
export const tweak = action("tweak", internalTweak)

/**
 * @ignore
 * @internal
 */
export function tryUntweak(value: any) {
  if (isPrimitive(value)) {
    return true
  }

  if (inDevMode()) {
    if (fastGetParent(value)) {
      throw failure("assertion failed: object cannot be untweaked while it has a parent")
    }
  }

  const untweaker = tweakedObjects.get(value)
  if (!untweaker) {
    return false
  }

  // we have to make a copy since it will be changed
  // we have to iterate ourselves since it seems like babel does not do downlevel iteration
  const children = []
  const childrenIter = getObjectChildren(value)!.values()
  let childrenCur = childrenIter.next()
  while (!childrenCur.done) {
    children.push(childrenCur.value)
    childrenCur = childrenIter.next()
  }

  for (let i = 0; i < children.length; i++) {
    const v = children[i]
    setParent(v, undefined, false, false)
  }

  untweaker()

  tweakedObjects.delete(value)
  unsetInternalSnapshot(value)
  return true
}
