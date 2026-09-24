import { action, isObservableArray, isObservableObject } from "mobx"
import { isDataModel } from "../dataModel/utils"
import { Frozen } from "../frozen/Frozen"
import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { getModelMetadata } from "../model/getModelMetadata"
import { isModel } from "../model/utils"
import { getObjectChildren } from "../parent/coreObjectChildren"
import { fastGetParent, type ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { fastIsRootStoreNoAtom } from "../rootStore/rootStore"
import { unsetInternalSnapshot } from "../snapshot/internal"
import type { AnyStandardType, TypeToData } from "../types/schemas"
import { typeCheck } from "../types/typeCheck"
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
import { getSafeErrorValuePreview } from "../utils/errorDiagnostics"
import { deactivateHandlers, isTweakedObject } from "./core"
import { registerDefaultTweakers } from "./registerDefaultTweakers"
import { treeNodeMetadata } from "./treeNodeMetadata"

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
export function toTreeNode(...args: [arg1: any] | [arg1: any, arg2: any]): any {
  const [arg1, arg2] = args
  let value: object
  let type: AnyStandardType | undefined
  let hasType: boolean
  if (args.length === 1) {
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
  // already tweaked
  if (isTweakedObject(value, true)) {
    value = setParent(
      value,
      parentPath,
      false, // isDataObject
      true // cloneIfApplicable
    )
    return value
  }

  // unsupported (must go before plain object tweaker)
  if (isDataModel(value)) {
    throw dataModelsNotSupportedError()
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

  throw unsupportedValueError(value)
}

function dataModelsNotSupportedError() {
  return failure(
    "data models are not directly supported. you may insert the data in the tree instead ('$' property)."
  )
}

function unsupportedValueError(value: unknown) {
  if (isMap(value)) {
    return failure("maps are not directly supported. consider using 'ObjectMap' / 'asMap' instead.")
  }
  if (isSet(value)) {
    return failure("sets are not directly supported. consider using 'ArraySet' / 'asSet' instead.")
  }
  return failure(
    `tweak can only work over models, observable objects/arrays, or primitives, but got ${getSafeErrorValuePreview(value)} instead`
  )
}

const tweakNonPrimitive = action("tweak", internalTweak)

/**
 * @internal
 */
export function tweak<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  // Primitives need no tree bookkeeping or MobX action boundary.
  return isPrimitive(value) ? value : tweakNonPrimitive(value, parentPath)
}

/**
 * Tells whether a node that has a parent gets detached by the change being
 * intercepted before the new values are attached.
 * @internal
 */
export type IsDetachedByChange = (node: object, parentPath: ParentPath<any>) => boolean

// nodes to be attached by the change being checked, since a node cannot be
// attached twice
const seenNodes = new Set<object>()

/**
 * Throws the error `tweak` or `setParent` would throw when attaching `values`
 * (and whatever they contain) after the change being intercepted detaches its
 * values, without changing anything. Interceptors call it before detaching, so
 * a rejected change leaves the tree as it was.
 * `prepareValue`, when given, replaces each value before it is checked.
 * @internal
 */
export function assertCanAttach(
  values: unknown[],
  isDetachedByChange: IsDetachedByChange,
  prepareValue?: (value: unknown) => unknown
): void {
  try {
    for (let i = 0; i < values.length; i++) {
      if (prepareValue) {
        values[i] = prepareValue(values[i])
      }
      checkAttach(values[i], isDetachedByChange)
    }
  } finally {
    seenNodes.clear()
  }
}

/**
 * `assertCanAttach` for a single value.
 * @internal
 */
export function assertCanAttachValue(value: unknown, isDetachedByChange: IsDetachedByChange): void {
  if (isPrimitive(value)) {
    return
  }
  try {
    checkAttach(value, isDetachedByChange)
  } finally {
    seenNodes.clear()
  }
}

function checkAttach(value: unknown, isDetachedByChange: IsDetachedByChange): void {
  if (isPrimitive(value)) {
    return
  }

  // (one metadata lookup instead of one per helper)
  const metadata = treeNodeMetadata.get(value)
  if (metadata?.tweaked) {
    if (metadata.dataObjectParent !== undefined) {
      throw failure("value must be the model object instance instead of the '$' sub-object")
    }
    if (fastIsRootStoreNoAtom(value)) {
      throw failure("root stores cannot be attached to any parents")
    }
    if (isModel(value) && getModelMetadata(value).valueType) {
      // setParent clones it when it has a parent
      return
    }
    const parentPath = metadata.parentPath
    if (
      parentPath &&
      !isDetachedByChange(value, parentPath) &&
      !isUntweakedByChange(parentPath.parent, isDetachedByChange)
    ) {
      throw failure("an object cannot be assigned a new parent when it already has one")
    }
    assertNotSeen(value)
    return
  }

  // the values internalTweak accepts, most common first
  if (isPlainObject(value)) {
    if (isObservableObject(value)) {
      // (it becomes the tree node itself)
      assertNotSeen(value)
    }
    checkAttachProps(value, isDetachedByChange)
    return
  }
  if (isArray(value)) {
    if (isObservableArray(value)) {
      assertNotSeen(value)
    }
    for (let i = 0; i < value.length; i++) {
      checkAttach(value[i], isDetachedByChange)
    }
    return
  }
  // (data models, frozen values and models can be observable objects too)
  if (isDataModel(value)) {
    throw dataModelsNotSupportedError()
  }
  if (value instanceof Frozen || isModel(value)) {
    return
  }
  if (isObservableObject(value)) {
    assertNotSeen(value)
    checkAttachProps(value as Record<string, unknown>, isDetachedByChange)
    return
  }
  throw unsupportedValueError(value)
}

function checkAttachProps(obj: Record<string, unknown>, isDetachedByChange: IsDetachedByChange) {
  const keys = Object.keys(obj)
  for (let i = 0; i < keys.length; i++) {
    checkAttach(obj[keys[i]], isDetachedByChange)
  }
}

function assertNotSeen(value: object) {
  if (seenNodes.has(value)) {
    throw failure("an object cannot be assigned a new parent when it already has one")
  }
  seenNodes.add(value)
}

/**
 * Detaching a plain object or array untweaks it, which detaches its children.
 */
function isUntweakedByChange(node: object, isDetachedByChange: IsDetachedByChange): boolean {
  for (;;) {
    const metadata = treeNodeMetadata.get(node)
    if (!metadata?.handlersActive) {
      return false
    }
    const parentPath = metadata.parentPath
    if (!parentPath) {
      return false
    }
    if (isDetachedByChange(node, parentPath)) {
      return true
    }
    node = parentPath.parent
  }
}

/**
 * @internal
 */
export function tryUntweak(value: any): (() => void) | undefined {
  if (isPrimitive(value)) {
    return undefined
  }

  if (inDevMode) {
    if (!fastGetParent(value, false)) {
      throw failure("assertion failed: object cannot be untweaked if it does not have a parent")
    }
  }

  const metadata = treeNodeMetadata.get(value)
  if (!metadata?.handlersActive) {
    return undefined
  }

  // pre-untweaking, untweak children first

  // we have to make a copy since it will be changed
  const children = Array.from(getObjectChildren(value).values())

  for (let i = 0; i < children.length; i++) {
    setParent(
      children[i], // value
      undefined, // parentPath
      false, // isDataObject
      // no need to clone if unsetting the parent
      false // cloneIfApplicable
    )
  }

  return () => {
    // post-untweaking
    deactivateHandlers(value, metadata)

    // Match the former independent-map ordering: the node stops being tweaked
    // before its snapshot is unset, but the shared record must stay alive until
    // snapshot cleanup has consumed it.
    metadata.tweaked = false
    unsetInternalSnapshot(value)
    // These associations previously lived in independent WeakMaps and remain
    // valid across untweak/retweak, so keep their shared record when present.
    if (metadata.dataObjectParent === undefined && metadata.objectChildren === undefined) {
      treeNodeMetadata.delete(value)
    }
  }
}
