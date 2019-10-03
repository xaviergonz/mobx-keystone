import { action, isObservableObject } from "mobx"
import { Frozen } from "../frozen/Frozen"
import { isModel } from "../model/utils"
import { getObjectChildren } from "../parent/coreObjectChildren"
import { fastGetParent, ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { unsetInternalSnapshot } from "../snapshot/internal"
import {
  failure,
  inDevMode,
  isArray,
  isMap,
  isObject,
  isPlainObject,
  isPrimitive,
  isSet,
} from "../utils"
import { isTweakedObject, tweakedObjects } from "./core"
import { tweakArray } from "./tweakArray"
import { tweakFrozen } from "./tweakFrozen"
import { tweakModel } from "./tweakModel"
import { tweakPlainObject } from "./tweakPlainObject"

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
 */
function internalTweak<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  if (isPrimitive(value)) {
    return value
  }

  if (isTweakedObject(value as any, true)) {
    setParent(value, parentPath, false, false)
    return value
  }

  if (isModel(value)) {
    return tweakModel(value, parentPath)
  }

  if (isArray(value)) {
    return tweakArray(value, parentPath, false)
  }

  // plain object
  if (isObservableObject(value) || isPlainObject(value)) {
    return tweakPlainObject(value, parentPath, undefined, false, false)
  }

  if ((value as any) instanceof Frozen) {
    return tweakFrozen(value, parentPath)
  }

  // unsupported
  if (isMap(value)) {
    throw failure("maps are not supported")
  }

  // unsupported
  if (isSet(value)) {
    throw failure("sets are not supported")
  }

  throw failure(
    `tweak can only work over models, observable objects/arrays, or primitives, but got ${value} instead`
  )
}

/**
 * @ignore
 */
export const tweak = action("tweak", internalTweak)

/**
 * @ignore
 */
export function tryUntweak(value: any) {
  if (isPrimitive(value)) {
    return true
  }

  if (inDevMode()) {
    if (fastGetParent(value)) {
      throw failure("assertion error: object cannot be untweaked while it has a parent")
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
