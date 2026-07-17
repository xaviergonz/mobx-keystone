import { action, isAction } from "mobx"
import { fastGetParentPath, type ParentPath } from "../parent/path"
import type { Path, PathElement, WritablePath } from "../parent/pathTypes"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction, deleteFromArray, failure } from "../utils"

/**
 * Disposer function to stop listening to deep changes.
 */
export type OnDeepChangeDisposer = () => void

export enum DeepChangeType {
  ArraySplice = "arraySplice",
  ArrayUpdate = "arrayUpdate",
  ObjectAdd = "objectAdd",
  ObjectUpdate = "objectUpdate",
  ObjectRemove = "objectRemove",
}

export interface DeepChangeBase {
  readonly type: DeepChangeType
  readonly path: Path
  /**
   * Whether this change occurred during initialization (e.g., setting default values, onInit modifications).
   * This is `true` when the change is part of snapshot initialization, `false` for runtime changes.
   */
  readonly isInit: boolean
}

/**
 * A splice change in an array.
 */
export interface ArraySpliceChange extends DeepChangeBase {
  readonly type: DeepChangeType.ArraySplice
  readonly target: unknown[]
  readonly index: number
  // readonly addedCount: number // not needed as we have addedValues.length
  // readonly removedCount: number // not needed as we have removedValues.length
  readonly addedValues: unknown[]
  readonly removedValues: unknown[]
}

/**
 * An update change in an array (single element replaced).
 */
export interface ArrayUpdateChange extends DeepChangeBase {
  readonly type: DeepChangeType.ArrayUpdate
  readonly target: unknown[]
  readonly index: number
  readonly newValue: unknown
  readonly oldValue: unknown
}

/**
 * A property added to an object.
 */
export interface ObjectAddChange extends DeepChangeBase {
  readonly type: DeepChangeType.ObjectAdd
  readonly target: object
  readonly key: string
  readonly newValue: unknown
}

/**
 * A property updated in an object.
 */
export interface ObjectUpdateChange extends DeepChangeBase {
  readonly type: DeepChangeType.ObjectUpdate
  readonly target: object
  readonly key: string
  readonly newValue: unknown
  readonly oldValue: unknown
}

/**
 * A property removed from an object.
 */
export interface ObjectRemoveChange extends DeepChangeBase {
  readonly type: DeepChangeType.ObjectRemove
  readonly target: object
  readonly key: string
  readonly oldValue: unknown
}

/**
 * A deep change event.
 */
export type DeepChange =
  | ArraySpliceChange
  | ArrayUpdateChange
  | ObjectAddChange
  | ObjectUpdateChange
  | ObjectRemoveChange

/**
 * A function that gets called when a deep change is emitted.
 */
export type OnDeepChangeListener = (change: DeepChange) => void

const deepChangeListeners = new WeakMap<object, OnDeepChangeListener[]>()
const globalDeepChangeListeners: ((target: object, change: DeepChange) => void)[] = []
const emptyPath: Path = Object.freeze([])

let deepChangeListenerCount = 0

let initPhaseDepth = 0

/**
 * @internal
 */
export function hasAnyDeepChangeListeners(): boolean {
  return deepChangeListenerCount > 0 || hasGlobalDeepChangeListeners()
}

/**
 * @internal
 */
export function hasGlobalDeepChangeListeners(): boolean {
  return globalDeepChangeListeners.length > 0
}

/**
 * @internal
 * Returns whether we're currently in an initialization phase.
 */
export function getIsInInitPhase(): boolean {
  return initPhaseDepth > 0
}

/**
 * @internal
 */
export function enterInitPhase(): void {
  initPhaseDepth++
}

/**
 * @internal
 */
export function exitInitPhase(): void {
  if (initPhaseDepth > 0) {
    initPhaseDepth--
  }
}

/**
 * @internal
 */
export function emitDeepChange(obj: object, change: DeepChange): void {
  if (!hasAnyDeepChangeListeners()) {
    return
  }

  emitGlobalDeepChange(obj, change)
  if (deepChangeListenerCount > 0) {
    emitDeepChangeToListeners(obj, change)
  }
}

/**
 * @internal
 */
export function emitObjectAddDeepChange(
  node: object,
  target: object,
  key: string,
  newValue: unknown
): void {
  emitDeepChangeFromValues(node, DeepChangeType.ObjectAdd, target, key, newValue, undefined)
}

/**
 * @internal
 */
export function emitObjectUpdateDeepChange(
  node: object,
  target: object,
  key: string,
  newValue: unknown,
  oldValue: unknown
): void {
  emitDeepChangeFromValues(node, DeepChangeType.ObjectUpdate, target, key, newValue, oldValue)
}

/**
 * @internal
 */
export function emitObjectRemoveDeepChange(
  node: object,
  target: object,
  key: string,
  oldValue: unknown
): void {
  emitDeepChangeFromValues(node, DeepChangeType.ObjectRemove, target, key, undefined, oldValue)
}

/**
 * @internal
 */
export function emitArraySpliceDeepChange(
  node: object,
  target: unknown[],
  index: number,
  addedValues: unknown[],
  removedValues: unknown[]
): void {
  emitDeepChangeFromValues(
    node,
    DeepChangeType.ArraySplice,
    target,
    index,
    undefined,
    undefined,
    addedValues,
    removedValues
  )
}

/**
 * @internal
 */
export function emitArrayUpdateDeepChange(
  node: object,
  target: unknown[],
  index: number,
  newValue: unknown,
  oldValue: unknown
): void {
  emitDeepChangeFromValues(node, DeepChangeType.ArrayUpdate, target, index, newValue, oldValue)
}

function emitDeepChangeFromValues(
  node: object,
  type: DeepChangeType,
  target: object | unknown[],
  keyOrIndex: string | number,
  newValue: unknown,
  oldValue: unknown,
  addedValues?: unknown[],
  removedValues?: unknown[]
): void {
  let change: DeepChange | undefined

  if (globalDeepChangeListeners.length > 0) {
    change = createDeepChange(
      type,
      target,
      keyOrIndex,
      newValue,
      oldValue,
      addedValues,
      removedValues
    )
    emitGlobalDeepChange(node, change)
  }

  if (deepChangeListenerCount === 0) {
    return
  }

  // Segments are pushed in child-to-root order (O(1) each) rather than unshifted
  // at the front (O(depth) each), keeping the whole walk O(depth) instead of
  // O(depth^2) on deep trees.
  const reversedPrefix: WritablePath = []
  let current: object | undefined = node
  while (current) {
    const listenersForObject = deepChangeListeners.get(current)
    if (listenersForObject && listenersForObject.length > 0) {
      change ??= createDeepChange(
        type,
        target,
        keyOrIndex,
        newValue,
        oldValue,
        addedValues,
        removedValues
      )
      emitDeepChangeForTarget(current, change, reversedPrefix, reversedPrefix.length)
    }

    const parentPath: ParentPath<object> | undefined = fastGetParentPath(current, false)
    if (!parentPath) {
      break
    }
    reversedPrefix.push(parentPath.path)
    current = parentPath.parent
  }
}

function createDeepChange(
  type: DeepChangeType,
  target: object | unknown[],
  keyOrIndex: string | number,
  newValue: unknown,
  oldValue: unknown,
  addedValues: unknown[] | undefined,
  removedValues: unknown[] | undefined
): DeepChange {
  const isInit = getIsInInitPhase()
  switch (type) {
    case DeepChangeType.ObjectAdd:
      return {
        type,
        target: target as object,
        path: emptyPath,
        key: keyOrIndex as string,
        newValue,
        isInit,
      }
    case DeepChangeType.ObjectUpdate:
      return {
        type,
        target: target as object,
        path: emptyPath,
        key: keyOrIndex as string,
        newValue,
        oldValue,
        isInit,
      }
    case DeepChangeType.ObjectRemove:
      return {
        type,
        target: target as object,
        path: emptyPath,
        key: keyOrIndex as string,
        oldValue,
        isInit,
      }
    case DeepChangeType.ArraySplice:
      return {
        type,
        target: target as unknown[],
        path: emptyPath,
        index: keyOrIndex as number,
        addedValues: addedValues!,
        removedValues: removedValues!,
        isInit,
      }
    case DeepChangeType.ArrayUpdate:
      return {
        type,
        target: target as unknown[],
        path: emptyPath,
        index: keyOrIndex as number,
        newValue,
        oldValue,
        isInit,
      }
    default:
      throw failure("unsupported deep change type")
  }
}

function emitGlobalDeepChange(obj: object, change: DeepChange): void {
  for (let i = 0; i < globalDeepChangeListeners.length; i++) {
    const listener = globalDeepChangeListeners[i]
    listener(obj, change)
  }
}

function emitDeepChangeToListeners(obj: object, change: DeepChange): void {
  // Segments are pushed in child-to-root order (O(1) each) rather than unshifted
  // at the front (O(depth) each), keeping the whole walk O(depth) instead of
  // O(depth^2) on deep trees.
  const reversedPrefix: WritablePath = []

  emitDeepChangeForTarget(obj, change, reversedPrefix, 0)

  // and also emit subtree listeners all the way to the root
  let parentPath = fastGetParentPath(obj, false)
  while (parentPath) {
    reversedPrefix.push(parentPath.path)
    emitDeepChangeForTarget(parentPath.parent, change, reversedPrefix, reversedPrefix.length)

    parentPath = fastGetParentPath(parentPath.parent, false)
  }
}

// `reversedPrefix` holds the path segments from the changed node up to (but not
// including) `obj`, in child-to-root order; the emitted path prepends that slice
// reversed (root-to-child). `prefixCount` is how many leading entries apply.
function emitDeepChangeForTarget(
  obj: object,
  change: DeepChange,
  reversedPrefix: readonly PathElement[],
  prefixCount: number
): void {
  const listenersForObject = deepChangeListeners.get(obj)

  if (!listenersForObject || listenersForObject.length === 0) {
    return
  }

  const changeWithPath =
    prefixCount > 0
      ? { ...change, path: buildPrefixedPath(reversedPrefix, prefixCount, change.path) }
      : change

  for (let i = 0; i < listenersForObject.length; i++) {
    const listener = listenersForObject[i]
    listener(changeWithPath)
  }
}

function buildPrefixedPath(
  reversedPrefix: readonly PathElement[],
  prefixCount: number,
  suffix: Path
): WritablePath {
  const newPath: WritablePath = new Array(prefixCount + suffix.length)
  for (let i = 0; i < prefixCount; i++) {
    newPath[i] = reversedPrefix[prefixCount - 1 - i]
  }
  for (let j = 0; j < suffix.length; j++) {
    newPath[prefixCount + j] = suffix[j]
  }
  return newPath
}

/**
 * Adds a listener that will be called every time a deep change is generated for the tree of the given target object.
 * Unlike `onPatches`, this provides raw MobX change information including proper splice detection for arrays.
 *
 * @param subtreeRoot Subtree root object of the deep change listener.
 * @param listener The listener function that will be called every time a change is generated for the object or its children.
 * @returns A disposer to stop listening to deep changes.
 */
export function onDeepChange(
  subtreeRoot: object,
  listener: OnDeepChangeListener
): OnDeepChangeDisposer {
  assertTweakedObject(subtreeRoot, "subtreeRoot")
  assertIsFunction(listener, "listener")

  if (!isAction(listener)) {
    listener = action(listener.name || "onDeepChangeListener", listener)
  }

  let listenersForObject = deepChangeListeners.get(subtreeRoot)
  if (!listenersForObject) {
    listenersForObject = []
    deepChangeListeners.set(subtreeRoot, listenersForObject)
  }

  listenersForObject.push(listener)
  deepChangeListenerCount++
  return () => {
    if (deleteFromArray(listenersForObject, listener)) {
      deepChangeListenerCount--
    }
  }
}

/**
 * Adds a listener that will be called every time a deep change is generated anywhere.
 * Usually prefer using `onDeepChange`.
 *
 * @param listener The listener function that will be called every time a change is generated anywhere.
 * @returns A disposer to stop listening to deep changes.
 */
export function onGlobalDeepChange(
  listener: (target: object, change: DeepChange) => void
): OnDeepChangeDisposer {
  assertIsFunction(listener, "listener")

  if (!isAction(listener)) {
    listener = action(listener.name || "onGlobalDeepChangeListener", listener)
  }

  globalDeepChangeListeners.push(listener)
  return () => {
    deleteFromArray(globalDeepChangeListeners, listener)
  }
}
