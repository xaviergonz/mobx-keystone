import { action, isAction } from "mobx"
import { fastGetParentPath } from "../parent/path"
import type { Path, WritablePath } from "../parent/pathTypes"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction, deleteFromArray } from "../utils"

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

let deepChangeListenerCount = 0

let initPhaseDepth = 0

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
  const hasAnyListeners = deepChangeListenerCount > 0 || globalDeepChangeListeners.length > 0

  if (!hasAnyListeners) {
    return
  }

  emitGlobalDeepChange(obj, change)
  if (deepChangeListenerCount > 0) {
    emitDeepChangeToListeners(obj, change)
  }
}

function emitGlobalDeepChange(obj: object, change: DeepChange): void {
  for (let i = 0; i < globalDeepChangeListeners.length; i++) {
    const listener = globalDeepChangeListeners[i]
    listener(obj, change)
  }
}

function emitDeepChangeToListeners(obj: object, change: DeepChange): void {
  const pathPrefix: WritablePath = []

  emitDeepChangeForTarget(obj, change, pathPrefix)

  // and also emit subtree listeners all the way to the root
  let parentPath = fastGetParentPath(obj, false)
  while (parentPath) {
    pathPrefix.unshift(parentPath.path)
    emitDeepChangeForTarget(parentPath.parent, change, pathPrefix)

    parentPath = fastGetParentPath(parentPath.parent, false)
  }
}

function emitDeepChangeForTarget(obj: object, change: DeepChange, pathPrefix: Path): void {
  const listenersForObject = deepChangeListeners.get(obj)

  if (!listenersForObject || listenersForObject.length === 0) {
    return
  }

  const changeWithPath =
    pathPrefix.length > 0
      ? {
          ...change,
          path: [...pathPrefix, ...change.path],
        }
      : change

  for (let i = 0; i < listenersForObject.length; i++) {
    const listener = listenersForObject[i]
    listener(changeWithPath)
  }
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
