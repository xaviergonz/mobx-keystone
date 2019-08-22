import { action, isObservableObject } from "mobx"
import { Frozen } from "../frozen/Frozen"
import { isModel } from "../model/utils"
import { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { failure, isArray, isMap, isObject, isPlainObject, isPrimitive, isSet } from "../utils"
import { isTreeNode, isTweakedObject } from "./core"
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

  if (!isTreeNode(value)) {
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

  if (isTweakedObject(value as any)) {
    setParent(value, parentPath)
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
    return tweakPlainObject(value, parentPath, undefined, false)
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
