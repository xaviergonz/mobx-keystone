import { computed, toJS } from "mobx"
import {
  getSnapshot,
  idProp,
  model,
  Model,
  modelAction,
  modelFlow,
  modelIdKey,
  prop,
  Ref,
  registerRootStore,
  rootRef,
  UndoEvent,
  UndoManager,
  undoMiddleware,
  UndoStore,
  withoutUndo,
  _async,
  _await,
} from "../../src"
import { autoDispose, timeMock } from "../utils"

let attachedState = "initial"

beforeEach(() => {
  attachedState = "initial"
})

@model("P2")
class P2 extends Model({
  y: prop(() => 0),
}) {
  @modelAction
  incY(n: number) {
    this.y += n
    attachedState = `afterIncY${n}`
  }
}

@model("P")
class P extends Model({
  p2: prop(() => new P2({})),
  x: prop(() => 0),
  arr: prop<number[]>(() => []),
}) {
  @modelAction
  incX(n: number) {
    this.x += n
    attachedState = `afterIncX${n}`
  }

  @modelAction
  incXY(x: number, y: number) {
    this.incX(x)
    this.p2.incY(y)
    attachedState = `afterIncXY${x},${y}`
    throw new Error("incXY")
  }

  @modelAction
  pushArr(x: number) {
    this.arr.push(x - 10)
    this.arr.push(x)
  }
}

@model("R")
class R extends Model({
  undoData: prop(() => new UndoStore({})),
  p: prop(() => new P({})),
}) {}

function expectUndoManagerRedoToBe(manager: UndoManager, undoLevels: number, redoLevels: number) {
  expect(manager.canUndo).toBe(undoLevels > 0)
  expect(manager.undoLevels).toBe(undoLevels)
  expect(manager.undoQueue.length).toBe(undoLevels)

  expect(manager.canRedo).toBe(redoLevels > 0)
  expect(manager.redoLevels).toBe(redoLevels)
  expect(manager.redoQueue.length).toBe(redoLevels)

  if (undoLevels <= 0) {
    expect(() => manager.undo()).toThrow("nothing to undo")
  }
  if (redoLevels <= 0) {
    expect(() => manager.redo()).toThrow("nothing to redo")
  }
}

test("undoMiddleware - sync", () => {
  const r = new R({})
  const p = r.p

  const manager = undoMiddleware(r, r.undoData, {
    attachedState: {
      save(): typeof attachedState {
        return attachedState
      },
      restore(s: typeof attachedState) {
        attachedState = s
      },
    },
  })
  expect(manager instanceof UndoManager).toBeTruthy()
  autoDispose(() => manager.dispose())

  function getEvents(): { undo: ReadonlyArray<UndoEvent>; redo: ReadonlyArray<UndoEvent> } {
    return {
      undo: manager.undoQueue,
      redo: manager.redoQueue,
    }
  }

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  const snapshots = []

  snapshots.push(getSnapshot(p))

  attachedState = "beforeIncX1"
  p.incX(1)
  snapshots.push(getSnapshot(p))

  attachedState = "beforeIncX2"
  p.incX(2)
  snapshots.push(getSnapshot(p))

  attachedState = "beforeIncY10"
  p.p2.incY(10)
  snapshots.push(getSnapshot(p))

  attachedState = "beforeIncXY3,20"
  expect(() => p.incXY(3, 20)).toThrow("incXY")
  snapshots.push(getSnapshot(p))

  expect(p.x).toBe(1 + 2 + 3)
  expect(p.p2.y).toBe(10 + 20)

  expectUndoRedoToBe(4, 0)
  expect(getEvents()).toMatchSnapshot()

  // 4 actions to undo, 5 snapshots

  expectUndoRedoToBe(4, 0)
  expect(getSnapshot(p)).toStrictEqual(snapshots[4])

  const expectedUndoAttachedStates = [
    "beforeIncX1",
    "beforeIncX2",
    "beforeIncY10",
    "beforeIncXY3,20",
  ]

  for (let i = 3; i >= 0; i--) {
    manager.undo()
    expectUndoRedoToBe(i, 4 - i)
    expect(getSnapshot(p)).toStrictEqual(snapshots[i])
    expect(attachedState).toBe(expectedUndoAttachedStates[i])
  }

  const expectedRedoAttachedStates = ["afterIncX1", "afterIncX2", "afterIncY10", "afterIncXY3,20"]

  for (let i = 1; i <= 4; i++) {
    manager.redo()
    expectUndoRedoToBe(i, 4 - i)
    expect(getSnapshot(p)).toStrictEqual(snapshots[i])
    expect(attachedState).toBe(expectedRedoAttachedStates[i - 1])
  }

  // check that after an action the redo queue gets cleared
  manager.undo()
  expectUndoRedoToBe(3, 1)
  p.incX(100)
  expectUndoRedoToBe(4, 0)

  // clear methods
  manager.undo()
  expectUndoRedoToBe(3, 1)
  manager.clearRedo()
  expectUndoRedoToBe(3, 0)
  manager.clearUndo()
  expectUndoRedoToBe(0, 0)

  // adding and removing from array
  p.pushArr(1)
  p.pushArr(2)
  expect(r.undoData.redoEvents).toHaveLength(0)
  expect(r.undoData.undoEvents).toMatchSnapshot()
  expectUndoRedoToBe(2, 0)

  expect(toJS(p.arr)).toEqual([-9, 1, -8, 2])
  manager.undo()
  expect(toJS(p.arr)).toEqual([-9, 1])
  manager.undo()
  expect(toJS(p.arr)).toEqual([])
  expectUndoRedoToBe(0, 2)

  manager.redo()
  expect(toJS(p.arr)).toEqual([-9, 1])
  manager.redo()
  expect(toJS(p.arr)).toEqual([-9, 1, -8, 2])
  expectUndoRedoToBe(2, 0)

  manager.clearUndo()
  expectUndoRedoToBe(0, 0)

  // doesn't record after disposing
  manager.dispose()
  p.incX(200)
  expectUndoRedoToBe(0, 0)
})

@model("P2Flow")
class P2Flow extends Model({
  y: prop(() => 0),
}) {
  private *_incY(n: number) {
    yield* _await(Promise.resolve())
    this.y += n
    yield* _await(Promise.resolve())
  }

  @modelFlow
  incY = _async(this._incY)
}

@model("PFlow")
class PFlow extends Model({
  x: prop(() => 0),
  p2: prop(() => new P2Flow({})),
}) {
  private *_incX(n: number) {
    yield* _await(Promise.resolve())
    this.x += n
    yield* _await(Promise.resolve())
  }

  @modelFlow
  incX = _async(this._incX)

  private *_incXY(x: number, y: number) {
    yield* _await(Promise.resolve())
    yield* _await(this.incX(x))
    yield* _await(Promise.resolve())
    yield* _await(this.p2.incY(y))
    yield* _await(Promise.resolve())
    throw new Error("incXY")
  }

  @modelFlow
  incXY = _async(this._incXY)
}

@model("RFlow")
class RFlow extends Model({
  undoData: prop(() => new UndoStore({})),
  p: prop(() => new PFlow({})),
}) {}

test("undoMiddleware - async", async () => {
  const r = new RFlow({})
  const p = r.p

  const manager = undoMiddleware(r, r.undoData)
  expect(manager instanceof UndoManager).toBeTruthy()
  autoDispose(() => manager.dispose())

  function getEvents(): { undo: ReadonlyArray<UndoEvent>; redo: ReadonlyArray<UndoEvent> } {
    return {
      undo: manager.undoQueue,
      redo: manager.redoQueue,
    }
  }

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  const snapshots = []

  snapshots.push(getSnapshot(p))

  await p.incX(1)
  snapshots.push(getSnapshot(p))

  await p.incX(2)
  snapshots.push(getSnapshot(p))

  await p.p2.incY(10)
  snapshots.push(getSnapshot(p))

  try {
    await p.incXY(3, 20)
    fail("should have thrown")
  } catch (e: any) {
    expect(e.message).toBe("incXY")
  }
  snapshots.push(getSnapshot(p))

  expect(p.x).toBe(1 + 2 + 3)
  expect(p.p2.y).toBe(10 + 20)

  expectUndoRedoToBe(4, 0)
  expect(getEvents()).toMatchSnapshot()

  // 4 actions to undo, 5 snapshots

  expectUndoRedoToBe(4, 0)
  expect(getSnapshot(p)).toStrictEqual(snapshots[4])

  for (let i = 3; i >= 0; i--) {
    manager.undo()
    expectUndoRedoToBe(i, 4 - i)
    expect(getSnapshot(p)).toStrictEqual(snapshots[i])
  }

  for (let i = 1; i <= 4; i++) {
    manager.redo()
    expectUndoRedoToBe(i, 4 - i)
    expect(getSnapshot(p)).toStrictEqual(snapshots[i])
  }

  // check that after an action the redo queue gets cleared
  manager.undo()
  expectUndoRedoToBe(3, 1)
  await p.incX(100)
  expectUndoRedoToBe(4, 0)

  // clear methods
  manager.undo()
  expectUndoRedoToBe(3, 1)
  manager.clearRedo()
  expectUndoRedoToBe(3, 0)
  manager.clearUndo()
  expectUndoRedoToBe(0, 0)

  // doesn't record after disposing
  manager.dispose()
  await p.incX(200)
  expectUndoRedoToBe(0, 0)
})

test("issue #115", () => {
  const elementRef = rootRef<ElementModel>("toryjs/ElementRef", {})

  @model("toryjs/ElementModel")
  class ElementModel extends Model({
    [modelIdKey]: idProp,
    name: prop<string>(),
    selected: prop<boolean>(),
  }) {
    @modelAction
    setSelected(value: boolean) {
      this.selected = value
    }
  }

  @model("toryjs/StateModel")
  class StateModel extends Model({
    selectedElementRef: prop<Ref<ElementModel> | undefined>(),
  }) {
    @modelAction
    selectElement(element?: ElementModel) {
      if (this.selectedElementRef != null) {
        this.selectedElementRef.current.setSelected(false)
      }

      this.selectedElementRef = element ? elementRef(element) : undefined

      if (this.selectedElementRef != null) {
        this.selectedElementRef.current.setSelected(true)
      }
    }

    @computed
    get selectedElement() {
      return this.selectedElementRef ? this.selectedElementRef.current : undefined
    }
  }

  @model("toryjs/RootModel")
  class RootModel extends Model({
    undoData: prop<UndoStore>(() => new UndoStore({})),
    store: prop<ElementModel[]>(),
    state: prop<StateModel>(),
  }) {}

  const model1 = new ElementModel({ name: "First", selected: false })
  const model2 = new ElementModel({ name: "Second", selected: false })
  const rootModel = new RootModel({
    store: [model1, model2],
    state: new StateModel({}),
  })
  registerRootStore(rootModel)

  const undoManager = undoMiddleware(rootModel, rootModel.undoData)

  function expectState(
    selectedModel: ElementModel | undefined,
    undoLevels: number,
    redoLevels: number
  ) {
    expect(model1.selected).toBe(model1 === selectedModel)
    expect(model2.selected).toBe(model2 === selectedModel)
    expect(rootModel.state.selectedElement).toBe(selectedModel)
    if (!selectedModel) {
      expect(rootModel.state.selectedElementRef).toBe(undefined)
    } else {
      expect(rootModel.state.selectedElementRef!.current).toBe(selectedModel)
    }
    expect(undoManager.undoLevels).toBe(undoLevels)
    expect(undoManager.redoLevels).toBe(redoLevels)
  }

  expectState(undefined, 0, 0)

  rootModel.state.selectElement(model1)
  expectState(model1, 1, 0)

  rootModel.state.selectElement(model2)
  expectState(model2, 2, 0)

  undoManager.undo()
  expectState(model1, 1, 1)

  undoManager.undo()
  expectState(undefined, 0, 2)

  undoManager.redo()
  expectState(model1, 1, 1)

  undoManager.redo()
  expectState(model2, 2, 0)
})

test("undo-aware substore called from non undo-aware root store", () => {
  @model("subactions/RootStore")
  class RootStore extends Model({
    substore: prop(() => new SubStore({})),
  }) {
    @modelAction
    addSubStoreValueIndirect(value: number) {
      this.substore.addValue(value)
    }

    @modelAction
    addSubStoreValueDirect(value: number) {
      this.substore.values.push(value)
    }
  }

  @model("subactions/SubStore")
  class SubStore extends Model({
    values: prop(() => [] as number[]),
  }) {
    @modelAction
    addValue(value: number) {
      this.values.push(value)
    }
  }

  const rootStore = new RootStore({})
  const manager = undoMiddleware(rootStore.substore)
  expect(manager.undoLevels).toBe(0)

  rootStore.substore.addValue(1)
  expect(toJS(rootStore.substore.values)).toEqual([1])
  expect(manager.undoLevels).toBe(1) // substore action directly called
  expect(manager.undoQueue).toMatchSnapshot()
  manager.clearUndo()

  rootStore.addSubStoreValueDirect(2)
  expect(toJS(rootStore.substore.values)).toEqual([1, 2])
  expect(manager.undoLevels).toBe(0) // no substore action called
  expect(manager.undoQueue).toHaveLength(0)
  manager.clearUndo()

  rootStore.addSubStoreValueIndirect(3)
  expect(toJS(rootStore.substore.values)).toEqual([1, 2, 3])
  expect(manager.undoLevels).toBe(1) // substore action indirectly called
  expect(manager.undoQueue).toMatchSnapshot()
  manager.clearUndo()
})

test("does not generate steps if using withoutUndo", () => {
  const r = new R({})
  const p = r.p

  const manager = undoMiddleware(r, r.undoData)
  autoDispose(() => manager.dispose())

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  manager.withoutUndo(() => {
    p.incX(1)
    p.incX(1)
  })

  withoutUndo(() => {
    p.incX(1)
    p.incX(1)
  })

  expect(p.x).toBe(4)
  expectUndoRedoToBe(0, 0)
})

test("withGroup", () => {
  const r = new R({})
  const p = r.p

  const manager = undoMiddleware(r, r.undoData)
  autoDispose(() => manager.dispose())

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  manager.withGroup("group1", () => {
    p.incX(1)
    p.incX(2)

    manager.withGroup(() => {
      p.incX(3)
      p.incX(4)
    })
  })

  expect(p.x).toBe(10)
  expectUndoRedoToBe(1, 0)
  expect(manager.undoQueue).toMatchSnapshot()

  manager.undo()
  expectUndoRedoToBe(0, 1)
  expect(p.x).toBe(0)
  expect(manager.redoQueue).toMatchSnapshot()

  manager.redo()
  expectUndoRedoToBe(1, 0)
  expect(p.x).toBe(10)
  expect(manager.undoQueue).toMatchSnapshot()
})

test("createGroup", () => {
  const r = new R({})
  const p = r.p

  const manager = undoMiddleware(r, r.undoData)
  autoDispose(() => manager.dispose())

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  const group1 = manager.createGroup("group1")
  const ret1 = group1.continue(() => {
    p.incX(1)
    p.incX(2)
    return "a"
  })
  expect(ret1).toBe("a")
  expectUndoRedoToBe(0, 0)

  p.p2.incY(100)
  expectUndoRedoToBe(1, 0)

  const ret2 = group1.continue(() => {
    p.incX(3)
    p.incX(4)
    return "b"
  })
  expect(ret2).toBe("b")
  expectUndoRedoToBe(1, 0)

  group1.end()

  expect(p.x).toBe(10)
  expectUndoRedoToBe(2, 0)
  expect(manager.undoQueue).toMatchSnapshot()
  expect(p.p2.y).toBe(100)

  manager.undo()
  expectUndoRedoToBe(1, 1)
  expect(p.x).toBe(0)
  expect(manager.redoQueue).toMatchSnapshot()
  expect(p.p2.y).toBe(100)

  manager.undo()
  expectUndoRedoToBe(0, 2)
  expect(p.x).toBe(0)
  expect(manager.redoQueue).toMatchSnapshot()
  expect(p.p2.y).toBe(0)

  manager.redo()
  expectUndoRedoToBe(1, 1)
  expect(p.x).toBe(0)
  expect(manager.undoQueue).toMatchSnapshot()
  expect(p.p2.y).toBe(100)

  manager.redo()
  expectUndoRedoToBe(2, 0)
  expect(p.x).toBe(10)
  expect(manager.undoQueue).toMatchSnapshot()
  expect(p.p2.y).toBe(100)
})

test("withGroupFlow - simple case", async () => {
  const r = new RFlow({})
  const p = r.p

  const manager = undoMiddleware(r, r.undoData)
  autoDispose(() => manager.dispose())

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  const retValue1 = await manager.withGroupFlow("group1", function* () {
    yield* _await(p.incX(1))
    yield* _await(p.incX(2))

    const retValue2 = yield* _await(
      manager.withGroupFlow(function* () {
        yield* _await(p.incX(3))
        yield* _await(p.incX(4))
        return 2
      })
    )
    expect(retValue2).toBe(2)
    return 1
  })

  expect(retValue1).toBe(1)

  expect(p.x).toBe(10)
  expectUndoRedoToBe(1, 0)
  expect(manager.undoQueue).toMatchSnapshot()

  manager.undo()
  expectUndoRedoToBe(0, 1)
  expect(p.x).toBe(0)
  expect(manager.redoQueue).toMatchSnapshot()

  manager.redo()
  expectUndoRedoToBe(1, 0)
  expect(p.x).toBe(10)
  expect(manager.undoQueue).toMatchSnapshot()
})

test("withGroupFlow - throwing", async () => {
  const r = new RFlow({})
  const p = r.p

  const manager = undoMiddleware(r, r.undoData)
  autoDispose(() => manager.dispose())

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  try {
    await manager.withGroupFlow("group1", function* () {
      yield* _await(p.incX(1))

      try {
        yield* _await(
          manager.withGroupFlow(function* () {
            yield* _await(p.incX(3))
            // eslint-disable-next-line no-throw-literal
            throw "inside"
          })
        )
        fail("should have thrown")
      } catch (err) {
        expect(err).toBe("inside")
        // eslint-disable-next-line no-throw-literal
        throw "outside"
      }
    })
    fail("should have thrown")
  } catch (err) {
    expect(err).toBe("outside")
  }

  expect(p.x).toBe(4)
  expectUndoRedoToBe(1, 0)
  expect(manager.undoQueue).toMatchSnapshot()

  manager.undo()
  expectUndoRedoToBe(0, 1)
  expect(p.x).toBe(0)
  expect(manager.redoQueue).toMatchSnapshot()

  manager.redo()
  expectUndoRedoToBe(1, 0)
  expect(p.x).toBe(4)
  expect(manager.undoQueue).toMatchSnapshot()
})

test("withGroupFlow - concurrent", async () => {
  const r = new RFlow({})
  const p = r.p

  const manager = undoMiddleware(r, r.undoData)
  autoDispose(() => manager.dispose())

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  const { advanceTimeTo } = timeMock()

  // 0
  const promise1 = manager.withGroupFlow("group1", function* () {
    yield* _await(p.incX(1))
    yield* _await(advanceTimeTo(190))
    yield* _await(p.incX(2))
  })

  expect(p.x).toBe(0)
  expect(p.p2.y).toBe(0)
  expectUndoRedoToBe(0, 0)

  // 5 - first incX run
  await advanceTimeTo(50)
  expect(p.x).toBe(1)
  expect(p.p2.y).toBe(0)
  expectUndoRedoToBe(0, 0)

  // 10
  await p.p2.incY(10)
  await advanceTimeTo(100)
  expect(p.x).toBe(1)
  expect(p.p2.y).toBe(10)
  expectUndoRedoToBe(1, 0)

  // 20 - second incX run
  await advanceTimeTo(200)
  expect(p.x).toBe(3)
  expect(p.p2.y).toBe(10)
  expectUndoRedoToBe(2, 0)
  await promise1

  await p.p2.incY(10)
  expect(p.x).toBe(3)
  expect(p.p2.y).toBe(20)
  expectUndoRedoToBe(3, 0)

  expect(manager.undoQueue).toMatchSnapshot()

  manager.undo()
  expectUndoRedoToBe(2, 1)
  expect(p.x).toBe(3)
  expect(p.p2.y).toBe(10)

  manager.undo()
  expectUndoRedoToBe(1, 2)
  expect(p.x).toBe(0)
  expect(p.p2.y).toBe(10)

  manager.undo()
  expectUndoRedoToBe(0, 3)
  expect(p.x).toBe(0)
  expect(p.p2.y).toBe(0)
})

test("concurrent async actions", async () => {
  const { advanceTimeTo } = timeMock()

  @model("ConcurrentAsyncActionsM")
  class ConcurrentAsyncActionsM extends Model({
    undoData: prop(() => new UndoStore({})),
    x: prop(() => 0),
    y: prop(() => 0),
  }) {
    private *_incX(x: number) {
      this.x += x
      yield* _await(advanceTimeTo(190))
      this.x += x
    }

    @modelFlow
    incX = _async(this._incX)

    private *_incY(y: number) {
      this.y += y
      yield* _await(advanceTimeTo(290))
      this.y += y
    }

    @modelFlow
    incY = _async(this._incY)
  }

  const r = new ConcurrentAsyncActionsM({})

  const manager = undoMiddleware(r, r.undoData)
  expect(manager instanceof UndoManager).toBeTruthy()
  autoDispose(() => manager.dispose())

  function getEvents(): { undo: ReadonlyArray<UndoEvent>; redo: ReadonlyArray<UndoEvent> } {
    return {
      undo: manager.undoQueue,
      redo: manager.redoQueue,
    }
  }

  function expectUndoRedoToBe(undoLevels: number, redoLevels: number) {
    expectUndoManagerRedoToBe(manager, undoLevels, redoLevels)
  }

  expectUndoRedoToBe(0, 0)

  const xPromise = r.incX(1)
  expect(r.x).toBe(1)
  expect(r.y).toBe(0)
  expectUndoRedoToBe(0, 0)

  await advanceTimeTo(100)
  expect(r.x).toBe(1)
  expect(r.y).toBe(0)
  expectUndoRedoToBe(0, 0)

  const yPromise = r.incY(10)
  expect(r.x).toBe(1)
  expect(r.y).toBe(10)
  expectUndoRedoToBe(0, 0)

  await advanceTimeTo(200)
  expect(r.x).toBe(2)
  expect(r.y).toBe(10)
  expectUndoRedoToBe(1, 0)

  await advanceTimeTo(300)
  expect(r.x).toBe(2)
  expect(r.y).toBe(20)
  expectUndoRedoToBe(2, 0)

  expect(getEvents()).toMatchSnapshot()

  await xPromise
  expect(r.x).toBe(2)
  expect(r.y).toBe(20)
  expectUndoRedoToBe(2, 0)

  await yPromise
  expect(r.x).toBe(2)
  expect(r.y).toBe(20)
  expectUndoRedoToBe(2, 0)

  manager.undo()
  expect(r.x).toBe(2)
  expect(r.y).toBe(0)
  expectUndoRedoToBe(1, 1)

  manager.undo()
  expect(r.x).toBe(0)
  expect(r.y).toBe(0)
  expectUndoRedoToBe(0, 2)
})

test("sorting crashes undo", () => {
  @model("sorting crashes undo/Todo")
  class Todo extends Model({
    order: prop(0),
    id: idProp,
  }) {}

  @model("sorting crashes undo/TodoList")
  class TodoList extends Model({
    todos: prop<Array<Todo>>(() => []),
  }) {
    @modelAction
    reorderTodos() {
      this.todos.sort((a, b) => a.order - b.order)
    }
  }

  const todoList = new TodoList({
    todos: [
      new Todo({ order: 0 }),
      new Todo({ order: 3 }),
      new Todo({ order: 2 }),
      new Todo({ order: 1 }),
      new Todo({ order: 4 }),
    ],
  })
  const undoManager = undoMiddleware(todoList)

  const sn = getSnapshot(todoList)

  todoList.reorderTodos()
  const snReordered = getSnapshot(todoList)

  undoManager.undo()
  expect(getSnapshot(todoList)).toEqual(sn)

  undoManager.redo()
  expect(getSnapshot(todoList)).toEqual(snReordered)
})
