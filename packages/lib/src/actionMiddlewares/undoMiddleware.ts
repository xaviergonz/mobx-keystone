import { action, computed } from "mobx"
import { ActionMiddlewareDisposer } from "../action/middleware"
import { modelAction } from "../action/modelAction"
import { Model } from "../model/Model"
import { model } from "../model/modelDecorator"
import { fastGetRootPath } from "../parent/path"
import { Path } from "../parent/pathTypes"
import { applyPatches, Patch, patchRecorder, PatchRecorder } from "../patch"
import { assertTweakedObject } from "../tweaker/core"
import { typesArray } from "../typeChecking/array"
import { tProp } from "../typeChecking/tProp"
import { typesUnchecked } from "../typeChecking/unchecked"
import { failure, getMobxVersion, mobx6 } from "../utils"
import { actionTrackingMiddleware, SimpleActionContext } from "./actionTrackingMiddleware"

/**
 * An undo/redo event.
 */
export type UndoEvent = UndoSingleEvent | UndoEventGroup

/**
 * Undo event type.
 */
export enum UndoEventType {
  Single = "single",
  Group = "group",
}

/**
 * An undo/redo single event.
 */
export interface UndoSingleEvent {
  /**
   * Expresses this is a single event.
   */
  readonly type: UndoEventType.Single
  /**
   * Path to the object that invoked the action from its root.
   */
  readonly targetPath: Path
  /**
   * Name of the action that was invoked.
   */
  readonly actionName: string
  /**
   * Patches with changes done inside the action.
   * Use `redo()` in the `UndoManager` to apply them.
   */
  readonly patches: ReadonlyArray<Patch>
  /**
   * Patches to undo the changes done inside the action.
   * Use `undo()` in the `UndoManager` to apply them.
   */
  readonly inversePatches: ReadonlyArray<Patch>
}

/**
 * An undo/redo event group.
 */
export interface UndoEventGroup {
  /**
   * Expresses this is an event group.
   */
  readonly type: UndoEventType.Group
  /**
   * Name of the group (if any).
   */
  readonly groupName?: string
  /**
   * Events that conform this group (might be single events or other nested groups).
   */
  readonly events: ReadonlyArray<UndoEvent>
}

function toSingleEvents(event: UndoEvent, reverse: boolean): ReadonlyArray<UndoSingleEvent> {
  if (event.type === UndoEventType.Single) return [event]
  else {
    const array: UndoSingleEvent[] = []
    for (const e of event.events) {
      if (reverse) {
        array.unshift(...toSingleEvents(e, true))
      } else {
        array.push(...toSingleEvents(e, false))
      }
    }
    return array
  }
}

/**
 * Store model instance for undo/redo actions.
 * Do not manipulate directly, other that creating it.
 */
@model("mobx-keystone/UndoStore")
export class UndoStore extends Model({
  // TODO: add proper type checking to undo store
  undoEvents: tProp(typesArray(typesUnchecked<UndoEvent>()), () => []),
  redoEvents: tProp(typesArray(typesUnchecked<UndoEvent>()), () => []),
}) {
  /**
   * @ignore
   */
  @modelAction
  _clearUndo() {
    withoutUndo(() => {
      this.undoEvents.length = 0
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _clearRedo() {
    withoutUndo(() => {
      this.redoEvents.length = 0
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _undo() {
    withoutUndo(() => {
      const event = this.undoEvents.pop()!
      this.redoEvents.push(event)
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _redo() {
    withoutUndo(() => {
      const event = this.redoEvents.pop()!
      this.undoEvents.push(event)
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _addUndo(event: UndoEvent) {
    withoutUndo(() => {
      this.undoEvents.push(event)
      // once an undo event is added redo queue is no longer valid
      this.redoEvents.length = 0
    })
  }

  private _groupStack: UndoEventGroup[] = []

  /**
   * @ignore
   */
  _addUndoToCurrentGroup(event: UndoEvent) {
    const group = this._groupStack[this._groupStack.length - 1]
    if (!group) {
      this._addUndo(event)
    } else {
      ;(group.events as UndoEvent[]).push(event)
    }
  }

  /**
   * @ignore
   */
  _startGroup(groupName: string | undefined) {
    this._groupStack.push({
      type: UndoEventType.Group,
      groupName,
      events: [],
    })
  }

  /**
   * @ignore
   */
  _endGroup() {
    const group = this._groupStack.pop()
    if (!group) {
      throw new Error("assertion failed: endGroup needs at least one group in the stack")
    }
    this._addUndoToCurrentGroup(group)
  }
}

/**
 * Manager class returned by `undoMiddleware` that allows you to perform undo/redo actions.
 */
export class UndoManager {
  /**
   * The store currently being used to store undo/redo action events.
   */
  readonly store: UndoStore

  /**
   * The undo stack, where the first operation to undo will be the last of the array.
   * Do not manipulate this array directly.
   */
  @computed
  get undoQueue(): ReadonlyArray<UndoEvent> {
    return this.store.undoEvents
  }

  /**
   * The redo stack, where the first operation to redo will be the last of the array.
   * Do not manipulate this array directly.
   */
  @computed
  get redoQueue(): ReadonlyArray<UndoEvent> {
    return this.store.redoEvents
  }

  /**
   * The number of undo actions available.
   */
  @computed
  get undoLevels() {
    return this.undoQueue.length
  }

  /**
   * If undo can be performed (if there is at least one undo action available).
   */
  @computed
  get canUndo() {
    return this.undoLevels > 0
  }

  /**
   * Clears the undo queue.
   */
  @action
  clearUndo() {
    this.store._clearUndo()
  }

  /**
   * The number of redo actions available.
   */
  @computed
  get redoLevels() {
    return this.redoQueue.length
  }

  /**
   * If redo can be performed (if there is at least one redo action available)
   */
  @computed
  get canRedo() {
    return this.redoLevels > 0
  }

  /**
   * Clears the redo queue.
   */
  @action
  clearRedo() {
    this.store._clearRedo()
  }

  /**
   * Undoes the last action.
   * Will throw if there is no action to undo.
   */
  @action
  undo() {
    if (!this.canUndo) {
      throw failure("nothing to undo")
    }
    const event = this.undoQueue[this.undoQueue.length - 1]

    withoutUndo(() => {
      toSingleEvents(event, true).forEach((e) => {
        applyPatches(this.subtreeRoot, e.inversePatches, true)
      })
    })

    this.store._undo()
  }

  /**
   * Redoes the previous action.
   * Will throw if there is no action to redo.
   */
  @action
  redo() {
    if (!this.canRedo) {
      throw failure("nothing to redo")
    }
    const event = this.redoQueue[this.redoQueue.length - 1]

    withoutUndo(() => {
      toSingleEvents(event, false).forEach((e) => {
        applyPatches(this.subtreeRoot, e.patches)
      })
    })

    this.store._redo()
  }

  /**
   * Disposes the undo middleware.
   */
  dispose() {
    this.disposer()
  }

  private _isUndoRecordingDisabled = false

  /**
   * Returns if undo recording is currently disabled or not for this particular `UndoManager`.
   */
  get isUndoRecordingDisabled() {
    return this._isUndoRecordingDisabled
  }

  /**
   * Skips the undo recording mechanism for the code block that gets run synchronously inside.
   *
   * @typeparam T Code block return type.
   * @param fn Code block to run.
   * @returns The value returned by the code block.
   */
  withoutUndo<T>(fn: () => T): T {
    const savedUndoDisabled = this._isUndoRecordingDisabled
    this._isUndoRecordingDisabled = true
    try {
      return fn()
    } finally {
      this._isUndoRecordingDisabled = savedUndoDisabled
    }
  }

  /**
   * Runs a synchronous code block as an undo group.
   * Note that nested groups are allowed.
   *
   * @param groupName Group name.
   * @param fn Code block.
   * @returns Code block return value.
   */
  withGroup<T>(groupName: string, fn: () => T): T

  /**
   * Runs a synchronous code block as an undo group.
   * Note that nested groups are allowed.
   *
   * @param fn Code block.
   * @returns Code block return value.
   */
  withGroup<T>(fn: () => T): T

  withGroup<T>(arg1: any, arg2?: any): T {
    let groupName: string | undefined
    let fn: () => T
    if (typeof arg1 === "string") {
      groupName = arg1
      fn = arg2
    } else {
      fn = arg1
    }

    this.store._startGroup(groupName)
    try {
      return fn()
    } finally {
      this.store._endGroup()
    }
  }

  /**
   * Creates an instance of `UndoManager`.
   * Do not use directly, use `undoMiddleware` instead.
   *
   * @param disposer
   * @param subtreeRoot
   * @param [store]
   */
  constructor(
    private readonly disposer: ActionMiddlewareDisposer,
    private readonly subtreeRoot: object,
    store?: UndoStore
  ) {
    if (getMobxVersion() >= 6) {
      mobx6.makeObservable(this)
    }

    this.store = store ?? new UndoStore({})
  }
}

/**
 * Creates an undo middleware.
 *
 * @param subtreeRoot Subtree root target object.
 * @param [store] Optional `UndoStore` where to store the undo/redo queues. Use this if you want to
 * store such queues somewhere in your models. If none is provided it will reside in memory.
 * @returns An `UndoManager` which allows you to do the manage the undo/redo operations and dispose of the middleware.
 */
export function undoMiddleware(subtreeRoot: object, store?: UndoStore): UndoManager {
  assertTweakedObject(subtreeRoot, "subtreeRoot")

  let manager: UndoManager

  interface PatchRecorderData {
    recorder: PatchRecorder
    recorderStack: number
    undoRootContext: SimpleActionContext
  }

  const patchRecorderSymbol = Symbol("patchRecorder")

  function initPatchRecorder(ctx: SimpleActionContext) {
    ctx.rootContext.data[patchRecorderSymbol] = {
      recorder: patchRecorder(subtreeRoot, {
        recording: false,
        filter: () => {
          return !_isGlobalUndoRecordingDisabled && !manager.isUndoRecordingDisabled
        },
      }),
      recorderStack: 0,
      undoRootContext: ctx,
    } as PatchRecorderData
  }

  function getPatchRecorderData(ctx: SimpleActionContext): PatchRecorderData {
    return ctx.rootContext.data[patchRecorderSymbol]
  }

  const middlewareDisposer = actionTrackingMiddleware(subtreeRoot, {
    onStart(ctx) {
      if (!getPatchRecorderData(ctx)) {
        initPatchRecorder(ctx)
      }
    },
    onResume(ctx) {
      const patchRecorderData = getPatchRecorderData(ctx)
      patchRecorderData.recorderStack++
      patchRecorderData.recorder.recording = patchRecorderData.recorderStack > 0
    },
    onSuspend(ctx) {
      const patchRecorderData = getPatchRecorderData(ctx)
      patchRecorderData.recorderStack--
      patchRecorderData.recorder.recording = patchRecorderData.recorderStack > 0
    },
    onFinish(ctx) {
      const patchRecorderData = getPatchRecorderData(ctx)
      if (patchRecorderData && patchRecorderData.undoRootContext === ctx) {
        const patchRecorder = patchRecorderData.recorder

        if (patchRecorder.events.length > 0) {
          const patches: Patch[] = []
          const inversePatches: Patch[] = []

          for (const event of patchRecorder.events) {
            patches.push(...event.patches)
            inversePatches.push(...event.inversePatches)
          }

          manager.store._addUndoToCurrentGroup({
            type: UndoEventType.Single,
            targetPath: fastGetRootPath(ctx.target).path,
            actionName: ctx.actionName,
            patches,
            inversePatches,
          })
        }

        patchRecorder.dispose()
      }
    },
  })

  manager = new UndoManager(middlewareDisposer, subtreeRoot, store)
  return manager
}

let _isGlobalUndoRecordingDisabled = false

/**
 * Returns if the undo recording mechanism is currently disabled.
 *
 * @returns `true` if it is currently disabled, `false` otherwise.
 */
export function isGlobalUndoRecordingDisabled() {
  return _isGlobalUndoRecordingDisabled
}

/**
 * Globally skips the undo recording mechanism for the code block that gets run synchronously inside.
 * Consider using the `withoutUndo` method of a particular `UndoManager` instead.
 *
 * @typeparam T Code block return type.
 * @param fn Code block to run.
 * @returns The value returned by the code block.
 */
export function withoutUndo<T>(fn: () => T): T {
  const savedUndoDisabled = _isGlobalUndoRecordingDisabled
  _isGlobalUndoRecordingDisabled = true
  try {
    return fn()
  } finally {
    _isGlobalUndoRecordingDisabled = savedUndoDisabled
  }
}
