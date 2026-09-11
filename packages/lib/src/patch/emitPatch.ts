import { action, isAction } from "mobx"
import { dataToModelNode } from "../parent/core"
import { fastGetParentPath, type ParentPath } from "../parent/path"
import type { PathElement } from "../parent/pathTypes"
import { freezeInternalSnapshot, getInternalSnapshot } from "../snapshot/internal"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction, deleteFromArray, isPrimitive } from "../utils"
import { forEachWithDelayedThrow } from "../utils/forEachWithDelayedThrow"
import type { Patch } from "./Patch"

const emptyPatchArray: Patch[] = []

/**
 * @internal
 */
export class InternalPatchRecorder {
  patches: Patch[] = emptyPatchArray
  invPatches: Patch[] = emptyPatchArray
  hasChanges = false

  reset() {
    this.patches = emptyPatchArray
    this.invPatches = emptyPatchArray
    this.hasChanges = false
  }

  record(patches: Patch[] | undefined, invPatches: Patch[] | undefined) {
    this.patches = patches ?? emptyPatchArray
    this.invPatches = invPatches ?? emptyPatchArray
    // An effective change requires at least one forward or inverse patch. A no-op
    // mutation (e.g. an equal-count splice where every value is identical) records
    // empty arrays and must not trigger ancestor type checking.
    this.hasChanges = this.patches.length > 0 || this.invPatches.length > 0
  }
}

const runNotification = (notify: () => void) => notify()

let patchEmissionDepth = 0
let emittingPendingPatches = false
const pendingPatchNotifications: (() => void)[] = []

/** @internal */
export function beginPatchEmission(): void {
  patchEmissionDepth++
}

/** @internal */
export function endPatchEmission(): void {
  patchEmissionDepth--
  flushPendingPatches()
}

function flushPendingPatches(): void {
  if (patchEmissionDepth > 0 || emittingPendingPatches || pendingPatchNotifications.length === 0)
    return
  emittingPendingPatches = true
  try {
    forEachWithDelayedThrow(pendingPatchNotifications, (notify) => notify())
  } finally {
    pendingPatchNotifications.length = 0
    emittingPendingPatches = false
  }
}

/**
 * @internal
 */
export function emitPatches(obj: object, patches: Patch[], invPatches: Patch[]): void {
  if (patches.length > 0 && (globalPatchListeners.length > 0 || patchListenerCount > 0)) {
    const synchronousNotifications: (() => void)[] = []
    if (globalPatchListeners.length > 0) {
      emitGlobalPatch(obj, patches, invPatches, synchronousNotifications)
    }
    if (patchListenerCount > 0) {
      emitPatch(obj, patches, invPatches, synchronousNotifications)
    }
    // Reserve every public notification and its path before recorder callbacks
    // can cause further mutations. Recorders must run within the mutation's
    // action / withoutUndo scope, even while public delivery is deferred.
    // A throwing recorder must not stop the ones registered on ancestor nodes,
    // nor swallow the deferred public delivery, so the flush is just one more
    // step of the same delayed-throw delivery.
    synchronousNotifications.push(flushPendingPatches)
    forEachWithDelayedThrow(synchronousNotifications, runNotification)
  }
}

/**
 * A function that gets called when a patch is emitted.
 */
export type OnPatchesListener = (patches: Patch[], inversePatches: Patch[]) => void

/**
 * A function that gets called when a global patch is emitted.
 */
export type OnGlobalPatchesListener = (
  target: object,
  patches: Patch[],
  inversePatches: Patch[]
) => void

/**
 * Disposer function to stop listening to patches.
 */
export type OnPatchesDisposer = () => void

interface PatchSubscription<Listener> {
  listener: Listener
  synchronous: boolean
  active: boolean
}

const patchListeners = new WeakMap<object, PatchSubscription<OnPatchesListener>[]>()
const globalPatchListeners: PatchSubscription<OnGlobalPatchesListener>[] = []
let patchListenerCount = 0

/**
 * @internal
 */
export function hasGlobalPatchListeners(): boolean {
  return globalPatchListeners.length > 0
}

/**
 * @internal
 */
export function hasPatchListenersFor(target: object): boolean {
  if (hasGlobalPatchListeners()) {
    return true
  }
  if (patchListenerCount === 0) {
    return false
  }

  let current: object | undefined = dataToModelNode(target)
  while (current) {
    if ((patchListeners.get(current)?.length ?? 0) > 0) {
      return true
    }

    const parentPath: ParentPath<object> | undefined = fastGetParentPath(current, false)
    current = parentPath?.parent
  }
  return false
}

/**
 * Adds a listener that will be called every time a patch is generated for the tree of the given target object.
 *
 * @param subtreeRoot Subtree root object of the patch listener.
 * @param listener The listener function that will be called everytime a patch is generated for the object or its children.
 * @returns A disposer to stop listening to patches.
 */
export function onPatches(subtreeRoot: object, listener: OnPatchesListener): OnPatchesDisposer {
  return internalOnPatches(subtreeRoot, listener, false)
}

/** @internal */
export function internalOnPatches(
  subtreeRoot: object,
  listener: OnPatchesListener,
  synchronous: boolean
): OnPatchesDisposer {
  assertTweakedObject(subtreeRoot, "subtreeRoot")
  assertIsFunction(listener, "listener")

  if (!isAction(listener)) {
    listener = action(listener.name || "onPatchesListener", listener)
  }

  let listenersForObject = patchListeners.get(subtreeRoot)
  if (!listenersForObject) {
    listenersForObject = []
    patchListeners.set(subtreeRoot, listenersForObject)
  }

  const subscription = { listener, synchronous, active: true }
  listenersForObject.push(subscription)
  patchListenerCount++
  return () => {
    subscription.active = false
    if (deleteFromArray(listenersForObject, subscription)) {
      patchListenerCount--
    }
  }
}

/**
 * Adds a listener that will be called every time a patch is generated anywhere.
 * Usually prefer using `onPatches`.
 *
 * @param listener The listener function that will be called everytime a patch is generated anywhere.
 * @returns A disposer to stop listening to patches.
 */
export function onGlobalPatches(listener: OnGlobalPatchesListener): OnPatchesDisposer {
  return internalOnGlobalPatches(listener, false)
}

/** @internal */
export function internalOnGlobalPatches(
  listener: OnGlobalPatchesListener,
  synchronous: boolean
): OnPatchesDisposer {
  assertIsFunction(listener, "listener")

  if (!isAction(listener)) {
    listener = action(listener.name || "onGlobalPatchesListener", listener)
  }

  const subscription = { listener, synchronous, active: true }
  globalPatchListeners.push(subscription)
  return () => {
    subscription.active = false
    deleteFromArray(globalPatchListeners, subscription)
  }
}

function notifyPatchSubscriptions<Args extends unknown[]>(
  subscriptions: PatchSubscription<(...args: Args) => void>[],
  args: Args,
  synchronous: boolean
): void {
  forEachWithDelayedThrow(subscriptions, (subscription) => {
    if (subscription.active && subscription.synchronous === synchronous) {
      subscription.listener(...args)
    }
  })
}

function reservePatchNotifications<Args extends unknown[]>(
  subscriptions: PatchSubscription<(...args: Args) => void>[],
  args: Args,
  synchronousNotifications: (() => void)[]
): void {
  let hasSynchronous = false
  let hasDeferred = false
  for (let i = 0; i < subscriptions.length; i++) {
    if (subscriptions[i].synchronous) {
      hasSynchronous = true
    } else {
      hasDeferred = true
    }
  }
  if (!hasSynchronous && !hasDeferred) {
    return
  }

  // A listener installed by a reentrant action must not receive earlier patches.
  const current = subscriptions.slice()
  if (hasDeferred) {
    pendingPatchNotifications.push(() => notifyPatchSubscriptions(current, args, false))
  }
  if (hasSynchronous) {
    synchronousNotifications.push(() => notifyPatchSubscriptions(current, args, true))
  }
}

function emitGlobalPatch(
  obj: object,
  patches: Patch[],
  inversePatches: Patch[],
  synchronousNotifications: (() => void)[]
): void {
  reservePatchNotifications(
    globalPatchListeners,
    [obj, patches, inversePatches],
    synchronousNotifications
  )
}

// `reversedPrefix` holds the path segments from the changed node up to (but not
// including) the current target, in child-to-root order. The prefix to prepend to
// a patch is that slice reversed (root-to-child); `prefixCount` is how many of the
// leading entries are relevant for the current target.
function emitPatchForTarget(
  obj: object,
  patches: Patch[],
  inversePatches: Patch[],
  reversedPrefix: readonly PathElement[],
  prefixCount: number,
  synchronousNotifications: (() => void)[]
): void {
  const listenersForObject = patchListeners.get(obj)

  if (!listenersForObject || listenersForObject.length === 0) {
    return
  }

  const patchesWithPathPrefix =
    prefixCount > 0 ? prefixPatches(patches, reversedPrefix, prefixCount) : patches
  const invPatchesWithPathPrefix =
    prefixCount > 0 ? prefixPatches(inversePatches, reversedPrefix, prefixCount) : inversePatches

  // Capture mutation-time paths before a deep-change listener can move nodes.
  reservePatchNotifications(
    listenersForObject,
    [patchesWithPathPrefix, invPatchesWithPathPrefix],
    synchronousNotifications
  )
}

function emitPatch(
  obj: object,
  patches: Patch[],
  inversePatches: Patch[],
  synchronousNotifications: (() => void)[]
): void {
  // Segments are pushed in child-to-root order (O(1) each) rather than unshifted
  // at the front (O(depth) each), keeping the whole walk O(depth) instead of
  // O(depth^2) on deep trees.
  const reversedPrefix: PathElement[] = []

  emitPatchForTarget(obj, patches, inversePatches, reversedPrefix, 0, synchronousNotifications)

  // and also emit subtree listeners all the way to the root
  let parentPath = fastGetParentPath(obj, false)
  while (parentPath) {
    reversedPrefix.push(parentPath.path)
    emitPatchForTarget(
      parentPath.parent,
      patches,
      inversePatches,
      reversedPrefix,
      reversedPrefix.length,
      synchronousNotifications
    )

    parentPath = fastGetParentPath(parentPath.parent, false)
  }
}

function prefixPatches(
  patchesArray: Patch[],
  reversedPrefix: readonly PathElement[],
  prefixCount: number
): Patch[] {
  const result = new Array<Patch>(patchesArray.length)
  for (let i = 0; i < patchesArray.length; i++) {
    result[i] = addPathToPatch(patchesArray[i], reversedPrefix, prefixCount)
  }
  return result
}

function addPathToPatch(
  patch: Patch,
  reversedPrefix: readonly PathElement[],
  prefixCount: number
): Patch {
  const patchPath = patch.path
  const newPath = new Array<PathElement>(prefixCount + patchPath.length)
  for (let i = 0; i < prefixCount; i++) {
    newPath[i] = reversedPrefix[prefixCount - 1 - i]
  }
  for (let j = 0; j < patchPath.length; j++) {
    newPath[prefixCount + j] = patchPath[j]
  }
  return {
    ...patch,
    path: newPath,
  }
}

const getValueSnapshotForPatch = (v: unknown) => {
  if (isPrimitive(v)) {
    return v
  }
  const internalSnapshot = getInternalSnapshot(v as object)
  if (!internalSnapshot) {
    // probably a plain value
    return v
  }
  return freezeInternalSnapshot(internalSnapshot.transformed)
}

/**
 * @internal
 */
export function createPatchForObjectValueChange(
  path: readonly PathElement[],
  oldValue: unknown,
  newValue: unknown
): Patch {
  return newValue === undefined
    ? { op: "remove", path }
    : oldValue === undefined
      ? {
          op: "add",
          path,
          value: getValueSnapshotForPatch(newValue),
        }
      : {
          op: "replace",
          path,
          value: getValueSnapshotForPatch(newValue),
        }
}
