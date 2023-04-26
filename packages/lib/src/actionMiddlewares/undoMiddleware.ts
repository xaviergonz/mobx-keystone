import { action, computed } from "mobx"
import type { ActionMiddlewareDisposer } from "../action/middleware"
import { modelAction } from "../action/modelAction"
import { Model } from "../model/Model"
import { model } from "../modelShared/modelDecorator"
import { fastGetRootPath } from "../parent/path"
import type { Path } from "../parent/pathTypes"
import { Patch, PatchRecorder, applyPatches, patchRecorder } from "../patch"
import { assertTweakedObject } from "../tweaker/core"
import { typesArray } from "../types/arrayBased/typesArray"
import { tProp } from "../types/tProp"
import { typesUnchecked } from "../types/utility/typesUnchecked"
import { failure, getMobxVersion, mobx6, namespace } from "../utils"
import { SimpleActionContext, actionTrackingMiddleware } from "./actionTrackingMiddleware"

/**
 * An undo/redo event without attached state.
 */
export type UndoEventWithoutAttachedState = UndoSingleEvent | UndoEventGroup

/**
 * An undo/redo event.
 */
export type UndoEvent = UndoEventWithoutAttachedState & {
  /**
   * The state saved before the event actions started / after the event actions finished.
   */
  attachedState: {
    /**
     * The state saved before the event actions started.
     */
    beforeEvent?: unknown
    /**
     * The state saved after the event actions finished.
     */
    afterEvent?: unknown
  }
}

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
  readonly events: ReadonlyArray<UndoEventWithoutAttachedState>
}

function toSingleEvents(
  event: UndoEventWithoutAttachedState,
  reverse: boolean
): ReadonlyArray<UndoSingleEvent> {
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
@model(`${namespace}/UndoStore`)
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
  enforceMaxLevels({
    maxUndoLevels,
    maxRedoLevels,
  }: {
    maxUndoLevels?: number
    maxRedoLevels?: number
  }) {
    if (maxUndoLevels !== undefined) {
      while (this.undoEvents.length > maxUndoLevels) {
        this.undoEvents.shift()
      }
    }
    if (maxRedoLevels !== undefined) {
      while (this.redoEvents.length > maxRedoLevels) {
        this.redoEvents.shift()
      }
    }
  }

  /**
   * @ignore
   */
  @modelAction
  _undo({ maxRedoLevels }: { maxRedoLevels: number | undefined }) {
    withoutUndo(() => {
      const event = this.undoEvents.pop()!
      this.redoEvents.push(event)
      this.enforceMaxLevels({ maxRedoLevels })
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _redo({ maxUndoLevels }: { maxUndoLevels: number | undefined }) {
    withoutUndo(() => {
      const event = this.redoEvents.pop()!
      this.undoEvents.push(event)
      this.enforceMaxLevels({ maxUndoLevels })
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _addUndo({ event, maxUndoLevels }: { event: UndoEvent; maxUndoLevels: number | undefined }) {
    withoutUndo(() => {
      this.undoEvents.push(event)
      // once an undo event is added redo queue is no longer valid
      this.redoEvents.length = 0
      this.enforceMaxLevels({ maxUndoLevels })
    })
  }

  private _groupStack: UndoEventGroup[] = []

  /**
   * @ignore
   */
  _addUndoToParentGroup(parentGroup: UndoEventGroup, event: UndoEventWithoutAttachedState) {
    ;(parentGroup.events as UndoEventWithoutAttachedState[]).push(event)
  }

  /**
   * @ignore
   */
  get _currentGroup(): UndoEventGroup | undefined {
    return this._groupStack[this._groupStack.length - 1]
  }

  /**
   * @ignore
   */
  _startGroup(
    groupName: string | undefined,
    startRunning: boolean,
    options: UndoMiddlewareOptions<unknown> | undefined
  ) {
    let running = false
    let ended = false
    const parentGroup = this._currentGroup

    const group: UndoEventGroup = {
      type: UndoEventType.Group,
      groupName,
      events: [],
    }

    const attachedStateBeforeEvent = parentGroup ? undefined : options?.attachedState?.save()

    const api = {
      pause: () => {
        if (ended) {
          throw failure("cannot pause a group when it is already ended")
        }
        if (!running) {
          throw failure("cannot pause a group when it is not running")
        }
        if (this._currentGroup !== group) {
          throw failure("group out of order")
        }
        this._groupStack.pop()
        running = false
      },
      resume: () => {
        if (ended) {
          throw failure("cannot resume a group when it is already ended")
        }
        if (running) {
          throw failure("cannot resume a group when it is already running")
        }
        this._groupStack.push(group)
        running = true
      },
      end: () => {
        if (running) {
          api.pause()
        }
        ended = true
        if (parentGroup) {
          this._addUndoToParentGroup(parentGroup, group)
        } else {
          this._addUndo({
            event: {
              ...group,
              attachedState: {
                beforeEvent: attachedStateBeforeEvent,
                afterEvent: options?.attachedState?.save(),
              },
            },
            maxUndoLevels: options?.maxUndoLevels,
          })
        }
      },
    }

    if (startRunning) {
      api.resume()
    }

    return api
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

      // restore the attached state before the operation was made
      if (event.attachedState?.beforeEvent) {
        this.options?.attachedState?.restore(event.attachedState.beforeEvent)
      }
    })

    this.store._undo({ maxRedoLevels: this.options?.maxRedoLevels })
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

      // restore the attached state after the operation was made
      if (event.attachedState?.afterEvent) {
        this.options?.attachedState?.restore(event.attachedState.afterEvent)
      }
    })

    this.store._redo({ maxUndoLevels: this.options?.maxUndoLevels })
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
   * Creates a custom group that can be continued multiple times and then ended.
   * @param groupName Optional group name.
   * @returns An API to continue/end the group.
   */
  createGroup(groupName?: string) {
    const group = this.store._startGroup(groupName, false, this.options)

    return {
      continue<T>(fn: () => T): T {
        group.resume()
        try {
          return fn()
        } finally {
          group.pause()
        }
      },

      end() {
        group.end()
      },
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

    const group = this.store._startGroup(groupName, true, this.options)
    try {
      return fn()
    } finally {
      group.end()
    }
  }

  /**
   * Runs an asynchronous code block as an undo group.
   * Note that nested groups are allowed.
   *
   * @param groupName Group name.
   * @param fn Flow function.
   * @returns Flow function return value.
   */
  withGroupFlow<R>(groupName: string, fn: () => Generator<any, R, any>): Promise<R>

  /**
   * Runs an asynchronous code block as an undo group.
   * Note that nested groups are allowed.
   *
   * @param fn Flow function.
   * @returns Flow function return value.
   */
  withGroupFlow<R>(fn: () => Generator<any, R, any>): Promise<R>

  withGroupFlow<R>(arg1: any, arg2?: any): Promise<R> {
    let groupName: string | undefined
    let fn: () => Generator<any, R, any>
    if (typeof arg1 === "string") {
      groupName = arg1
      fn = arg2
    } else {
      fn = arg1
    }

    const gen = fn()

    const group = this.store._startGroup(groupName, false, this.options)

    // use bound functions to fix es6 compilation
    const genNext = gen.next.bind(gen)
    const genThrow = gen.throw!.bind(gen)

    const promise = new Promise<R>(function (resolve, reject) {
      function onFulfilled(res: any): void {
        group.resume()
        let ret
        try {
          ret = genNext(res)
        } catch (e) {
          group.end()
          reject(e)
          return
        }

        group.pause()
        next(ret)
      }

      function onRejected(err: any): void {
        group.resume()
        let ret
        try {
          ret = genThrow(err)
        } catch (e) {
          group.end()
          reject(e)
          return
        }

        group.pause()
        next(ret)
      }

      function next(ret: any): void {
        if (ret && typeof ret.then === "function") {
          // an async iterator
          ret.then(next, reject)
        } else if (ret.done) {
          // done
          group.end()
          resolve(ret.value)
        } else {
          // continue
          Promise.resolve(ret.value).then(onFulfilled, onRejected)
        }
      }

      onFulfilled(undefined) // kick off the process
    })

    return promise
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
    store: UndoStore | undefined,
    private readonly options: UndoMiddlewareOptions<unknown> | undefined
  ) {
    if (getMobxVersion() >= 6) {
      mobx6.makeObservable(this)
    }

    this.store = store ?? new UndoStore({})
  }
}

/**
 * Undo middleware options.
 */
export interface UndoMiddlewareOptions<S> {
  /**
   * Max number of undo levels to keep, or undefined for infinite.
   */
  maxUndoLevels?: number

  /**
   * Max number of redo levels to keep, or undefined for infinite.
   */
  maxRedoLevels?: number

  /**
   * Attached states are states that are saved/restored when undoing/redoing.
   * Usually used to restore state that is not part of the document model such as focus, selection, scroll position, etc.
   */
  attachedState?: {
    /**
     * Saves a certain state and associates it with the undo step. This state can be restored when undoing/redoing.
     */
    save(): S
    /**
     * Restores a certain state previously saved.
     * @param s State to restore.
     */
    restore(s: S): void
  }
}

/**
 * Creates an undo middleware.
 *
 * @param subtreeRoot Subtree root target object.
 * @param store Optional `UndoStore` where to store the undo/redo queues. Use this if you want to
 * store such queues somewhere in your models. If none is provided it will reside in memory.
 * @param options Extra options, such as how to save / restore certain snapshot of the state to be restored when undoing/redoing.
 * @returns An `UndoManager` which allows you to do the manage the undo/redo operations and dispose of the middleware.
 */
export function undoMiddleware<S>(
  subtreeRoot: object,
  store?: UndoStore,
  options?: UndoMiddlewareOptions<S>
): UndoManager {
  assertTweakedObject(subtreeRoot, "subtreeRoot")

  let manager: UndoManager

  interface PatchRecorderData {
    recorder: PatchRecorder
    recorderStack: number
    undoRootContext: SimpleActionContext
    group: UndoEventGroup | undefined
    attachedStateBeforeEvent: S | undefined
  }

  const patchRecorderSymbol = Symbol("patchRecorder")

  function initPatchRecorder(ctx: SimpleActionContext) {
    const group = manager.store._currentGroup

    const patchRecorderData: PatchRecorderData = {
      recorder: patchRecorder(subtreeRoot, {
        recording: false,
        filter: () => {
          return !_isGlobalUndoRecordingDisabled && !manager.isUndoRecordingDisabled
        },
      }),
      recorderStack: 0,
      undoRootContext: ctx,
      group,

      attachedStateBeforeEvent: options?.attachedState?.save(),
    }

    ctx.rootContext.data[patchRecorderSymbol] = patchRecorderData
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

          const event = {
            type: UndoEventType.Single,
            targetPath: fastGetRootPath(ctx.target).path,
            actionName: ctx.actionName,
            patches,
            inversePatches,
          } as const

          const parentGroup = patchRecorderData.group

          if (parentGroup) {
            manager.store._addUndoToParentGroup(parentGroup, event)
          } else {
            manager.store._addUndo({
              event: {
                ...event,
                attachedState: {
                  beforeEvent: patchRecorderData.attachedStateBeforeEvent,
                  afterEvent: options?.attachedState?.save(),
                },
              },
              maxUndoLevels: options?.maxUndoLevels,
            })
          }
        }

        patchRecorder.dispose()
      }
    },
  })

  manager = new UndoManager(middlewareDisposer, subtreeRoot, store, options)
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
