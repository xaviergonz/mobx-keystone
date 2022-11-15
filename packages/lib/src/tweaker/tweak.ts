import { action } from "mobx"
import { isDataModel } from "../dataModel/utils"
import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { getObjectChildren } from "../parent/coreObjectChildren"
import { fastGetParent, ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { unsetInternalSnapshot } from "../snapshot/internal"
import type { AnyStandardType, TypeToData } from "../types/schemas"
import { typeCheck } from "../types/typeCheck"
import { failure, inDevMode, isMap, isObject, isPrimitive, isSet } from "../utils"
import { isTweakedObject, tweakedObjects } from "./core"
import { registerDefaultTweakers } from "./registerDefaultTweakers"

/**
 * Turns an object (array, plain object) into a tree node,
 * which then can accept calls to `getParent`, `getSnapshot`, etc.
 * If a tree node is passed it will return the passed argument directly.
 * Additionally this method will use the type passed to check the value
 * conforms to the type when model auto type checking is enabled.
 *
 * @param type Type checker.
 * @param value Object to turn into a tree node.
 * @returns The object as a tree node.
 */
export function toTreeNode<TType extends AnyStandardType, V extends TypeToData<TType>>(
  type: TType,
  value: V
): V

/**
 * Turns an object (array, plain object) into a tree node,
 * which then can accept calls to `getParent`, `getSnapshot`, etc.
 * If a tree node is passed it will return the passed argument directly.
 *
 * @param value Object to turn into a tree node.
 * @returns The object as a tree node.
 */
export function toTreeNode<T extends object>(value: T): T

// base
export function toTreeNode(arg1: any, arg2?: any): any {
  let value: object, type: AnyStandardType | undefined
  let hasType
  if (arguments.length === 1) {
    hasType = false
    value = arg1
  } else {
    type = arg1
    hasType = true
    value = arg2
  }

  if (!isObject(value)) {
    throw failure("only objects can be turned into tree nodes")
  }

  if (hasType && isModelAutoTypeCheckingEnabled()) {
    const errors = typeCheck(type, value)
    if (errors) {
      errors.throw()
    }
  }

  if (!isTweakedObject(value, true)) {
    return tweak(value, undefined)
  }
  return value
}

/**
 * @internal
 */
export type Tweaker<T> = (value: T, parentPath: ParentPath<any> | undefined) => T | undefined

const tweakers: { priority: number; tweaker: Tweaker<any> }[] = []

/**
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
  if (isTweakedObject(value, true)) {
    value = setParent({
      value,
      parentPath,
      indexChangeAllowed: false,
      isDataObject: false,
      cloneIfApplicable: true,
    })
    return value
  }

  // unsupported (must go before plain object tweaker)
  if (isDataModel(value)) {
    throw failure(
      "data models are not directly supported. you may insert the data in the tree instead ('$' property)."
    )
  }

  registerDefaultTweakers()

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
    throw failure("maps are not directly supported. consider using 'ObjectMap' / 'asMap' instead.")
  }

  // unsupported
  if (isSet(value)) {
    throw failure("sets are not directly supported. consider using 'ArraySet' / 'asSet' instead.")
  }

  throw failure(
    `tweak can only work over models, observable objects/arrays, or primitives, but got ${value} instead`
  )
}

/**
 * @internal
 */
export const tweak = action("tweak", internalTweak)

/**
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
    setParent({
      value: children[i],
      parentPath: undefined,
      indexChangeAllowed: false,
      isDataObject: false,
      // no need to clone if unsetting the parent
      cloneIfApplicable: false,
    })
  }

  untweaker()

  tweakedObjects.delete(value)
  unsetInternalSnapshot(value)
  return true
}
