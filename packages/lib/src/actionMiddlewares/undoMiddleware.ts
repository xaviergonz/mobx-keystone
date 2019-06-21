import { action, computed } from "mobx"
import { ActionMiddlewareDisposer } from "../action/middleware"
import { modelAction } from "../action/modelAction"
import { model } from "../model"
import { assertIsModel, Model } from "../model/Model"
import { getRootPath } from "../parent/path"
import { applyPatches, Patch, patchRecorder, PatchRecorder } from "../patch"
import { failure } from "../utils"
import { actionTrackingMiddleware, SimpleActionContext } from "./actionTrackingMiddleware"

/**
 * An undo/redo event.
 */
export interface UndoEvent {
  /**
   * Path to the object that invoked the action from its root.
   */
  readonly targetPath: string[]
  /**
   * Name of the action that was invoked.
   */
  readonly actionName: string
  /**
   * Patches with changes done inside the action.
   * Use `redo()` in the `UndoManager` to apply them.
   */
  readonly patches: Patch[]
  /**
   * Patches to undo the changes done inside the action.
   * Use `undo()` in the `UndoManager` to apply them.
   */
  readonly inversePathes: Patch[]
}

/**
 * Store model instance for undo/redo actions.
 * Do not manipulate directly, other that creating it.
 */
@model("mobx-state-tree-next/UndoStore")
export class UndoStore extends Model {
  /**
   * @ignore
   */
  data = {
    undoEvents: [] as UndoEvent[],
    redoEvents: [] as UndoEvent[],
  }

  /**
   * @ignore
   */
  @modelAction
  _clearUndo() {
    withoutUndo(() => {
      this.data.undoEvents.length = 0
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _clearRedo() {
    withoutUndo(() => {
      this.data.redoEvents.length = 0
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _undo() {
    withoutUndo(() => {
      const event = this.data.undoEvents.pop()!
      this.data.redoEvents.push(event)
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _redo() {
    withoutUndo(() => {
      const event = this.data.redoEvents.pop()!
      this.data.undoEvents.push(event)
    })
  }

  /**
   * @ignore
   */
  @modelAction
  _addUndo(event: UndoEvent) {
    withoutUndo(() => {
      this.data.undoEvents.push(event)
      // once an undo event is added redo queue is no longer valid
      this.data.redoEvents.length = 0
    })
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
   * Returns the undo stack, where the first operation to undo will be the last of the array.
   * Do not manipulate this array directly.
   */
  @computed
  get undoQueue(): ReadonlyArray<UndoEvent> {
    return this.store.data.undoEvents
  }

  /**
   * Returns the redo stack, where the first operation to redo will be the last of the array.
   * Do not manipulate this array directly.
   */
  @computed
  get redoQueue(): ReadonlyArray<UndoEvent> {
    return this.store.data.redoEvents
  }

  /**
   * Returns the number of undo actions available.
   */
  @computed
  get undoLevels() {
    return this.undoQueue.length
  }

  /**
   * Returns if undo can be performed (if there is at least one undo action available)
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
   * Returns the number of redo actions available.
   */
  @computed
  get redoLevels() {
    return this.redoQueue.length
  }

  /**
   * Returns if redo can be performed (if there is at least one redo action available)
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
   * Undos the last action.
   * Will throw if there is no action to undo.
   */
  @action
  undo() {
    if (!this.canUndo) {
      throw failure("nothing to undo")
    }
    const event = this.undoQueue[this.undoQueue.length - 1]

    withoutUndo(() => {
      applyPatches(this.target, event.inversePathes)
    })

    this.store._undo()
  }

  /**
   * Redos the last action.
   * Will throw if there is no action to redo.
   */
  @action
  redo() {
    if (!this.canRedo) {
      throw failure("nothing to redo")
    }
    const event = this.redoQueue[this.redoQueue.length - 1]

    withoutUndo(() => {
      applyPatches(this.target, event.patches)
    })

    this.store._redo()
  }

  /**
   * Dispose the undo middleware.
   */
  dispose() {
    this.disposer()
  }

  /**
   * Creates an instance of `UndoManager`.
   * Do not use directly, use `undoMiddleware` instead.
   *
   * @param disposer
   * @param target
   * @param [store]
   */
  constructor(
    private readonly disposer: ActionMiddlewareDisposer,
    private readonly target: Model,
    store?: UndoStore
  ) {
    this.store = store || new UndoStore()
  }
}

/**
 * Creates an undo middleware.
 *
 * @param model Root target model object.
 * @param [store] Optional `UndoStore` where to store the undo/redo queues. Use this if you want to
 * store such queues somewhere in your models. If none is provided it will reside in memory.
 * @returns An `UndoManager` which allows you to do the manage the undo/redo operations and dispose of the middleware.
 */
export function undoMiddleware(model: Model, store?: UndoStore): UndoManager {
  assertIsModel(model, "model")

  const patchRecorderSymbol = Symbol("patchRecorder")
  function initPatchRecorder(ctx: SimpleActionContext) {
    ctx.rootContext.data[patchRecorderSymbol] = patchRecorder(model, {
      recording: false,
      filter: undoDisabledFilter,
    })
  }
  function getPatchRecorder(ctx: SimpleActionContext): PatchRecorder {
    return ctx.rootContext.data[patchRecorderSymbol]
  }

  let manager: UndoManager

  const middlewareDisposer = actionTrackingMiddleware(
    { model },
    {
      onStart(ctx) {
        if (ctx === ctx.rootContext) {
          initPatchRecorder(ctx)
        }
      },
      onResume(ctx) {
        const patchRecorder = getPatchRecorder(ctx)
        patchRecorder.recording = true
      },
      onSuspend(ctx) {
        const patchRecorder = getPatchRecorder(ctx)
        patchRecorder.recording = false
      },
      onFinish(ctx) {
        if (ctx === ctx.rootContext) {
          const patchRecorder = getPatchRecorder(ctx)

          if (patchRecorder.patches.length > 0 || patchRecorder.inversePatches.length > 0) {
            manager.store._addUndo({
              targetPath: getRootPath(ctx.target).path,
              actionName: ctx.actionName,
              patches: patchRecorder.patches,
              inversePathes: patchRecorder.inversePatches,
            })
          }

          patchRecorder.dispose()
        }
      },
    }
  )

  manager = new UndoManager(middlewareDisposer, model, store)
  return manager
}

let undoDisabled = false

const undoDisabledFilter = () => {
  return !undoDisabled
}

/**
 * Skips the undo recording mechanism for the code block that gets run synchronously inside.
 *
 * @typeparam T
 * @param fn
 * @returns
 */
export function withoutUndo<T>(fn: () => T): T {
  const savedUndoDisabled = undoDisabled
  undoDisabled = true
  try {
    return fn()
  } finally {
    undoDisabled = savedUndoDisabled
  }
}
