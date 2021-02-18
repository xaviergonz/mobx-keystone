import { computed } from "mobx"
import {
  getSnapshot,
  model,
  Model,
  modelAction,
  modelFlow,
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
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P2")
class P2 extends Model({
  y: prop(() => 0),
}) {
  @modelAction
  incY(n: number) {
    this.y += n
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
  }

  @modelAction
  incXY(x: number, y: number) {
    this.incX(x)
    this.p2.incY(y)
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

  p.incX(1)
  snapshots.push(getSnapshot(p))

  p.incX(2)
  snapshots.push(getSnapshot(p))

  p.p2.incY(10)
  snapshots.push(getSnapshot(p))

  expect(() => p.incXY(3, 20)).toThrow("incXY")
  snapshots.push(getSnapshot(p))

  expect(p.x).toBe(1 + 2 + 3)
  expect(p.p2.y).toBe(10 + 20)

  expectUndoRedoToBe(4, 0)
  expect(getEvents()).toMatchInlineSnapshot(`
    Object {
      "redo": Array [],
      "undo": Array [
        Object {
          "actionName": "incX",
          "inversePatches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 0,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 1,
            },
          ],
          "targetPath": Array [
            "p",
          ],
        },
        Object {
          "actionName": "incX",
          "inversePatches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 1,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 3,
            },
          ],
          "targetPath": Array [
            "p",
          ],
        },
        Object {
          "actionName": "incY",
          "inversePatches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "p2",
                "y",
              ],
              "value": 0,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "p2",
                "y",
              ],
              "value": 10,
            },
          ],
          "targetPath": Array [
            "p",
            "p2",
          ],
        },
        Object {
          "actionName": "incXY",
          "inversePatches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 3,
            },
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "p2",
                "y",
              ],
              "value": 10,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 6,
            },
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "p2",
                "y",
              ],
              "value": 30,
            },
          ],
          "targetPath": Array [
            "p",
          ],
        },
      ],
    }
  `)

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
  expect(r.undoData.redoEvents).toMatchInlineSnapshot(`Array []`)
  expect(r.undoData.undoEvents).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionName": "pushArr",
        "inversePatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "p",
              "arr",
              "length",
            ],
            "value": 0,
          },
          Object {
            "op": "replace",
            "path": Array [
              "p",
              "arr",
              "length",
            ],
            "value": 1,
          },
        ],
        "patches": Array [
          Object {
            "op": "add",
            "path": Array [
              "p",
              "arr",
              0,
            ],
            "value": -9,
          },
          Object {
            "op": "add",
            "path": Array [
              "p",
              "arr",
              1,
            ],
            "value": 1,
          },
        ],
        "targetPath": Array [
          "p",
        ],
      },
      Object {
        "actionName": "pushArr",
        "inversePatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "p",
              "arr",
              "length",
            ],
            "value": 2,
          },
          Object {
            "op": "replace",
            "path": Array [
              "p",
              "arr",
              "length",
            ],
            "value": 3,
          },
        ],
        "patches": Array [
          Object {
            "op": "add",
            "path": Array [
              "p",
              "arr",
              2,
            ],
            "value": -8,
          },
          Object {
            "op": "add",
            "path": Array [
              "p",
              "arr",
              3,
            ],
            "value": 2,
          },
        ],
        "targetPath": Array [
          "p",
        ],
      },
    ]
  `)
  expectUndoRedoToBe(2, 0)

  expect(p.arr).toEqual([-9, 1, -8, 2])
  manager.undo()
  expect(p.arr).toEqual([-9, 1])
  manager.undo()
  expect(p.arr).toEqual([])
  expectUndoRedoToBe(0, 2)

  manager.redo()
  expect(p.arr).toEqual([-9, 1])
  manager.redo()
  expect(p.arr).toEqual([-9, 1, -8, 2])
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
  } catch (e) {
    expect(e.message).toBe("incXY")
  }
  snapshots.push(getSnapshot(p))

  expect(p.x).toBe(1 + 2 + 3)
  expect(p.p2.y).toBe(10 + 20)

  expectUndoRedoToBe(4, 0)
  expect(getEvents()).toMatchInlineSnapshot(`
    Object {
      "redo": Array [],
      "undo": Array [
        Object {
          "actionName": "incX",
          "inversePatches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 0,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 1,
            },
          ],
          "targetPath": Array [
            "p",
          ],
        },
        Object {
          "actionName": "incX",
          "inversePatches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 1,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 3,
            },
          ],
          "targetPath": Array [
            "p",
          ],
        },
        Object {
          "actionName": "incY",
          "inversePatches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "p2",
                "y",
              ],
              "value": 0,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "p2",
                "y",
              ],
              "value": 10,
            },
          ],
          "targetPath": Array [
            "p",
            "p2",
          ],
        },
        Object {
          "actionName": "incXY",
          "inversePatches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 3,
            },
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "p2",
                "y",
              ],
              "value": 10,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 6,
            },
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "p2",
                "y",
              ],
              "value": 30,
            },
          ],
          "targetPath": Array [
            "p",
          ],
        },
      ],
    }
  `)

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
  expect(rootStore.substore.values).toEqual([1])
  expect(manager.undoLevels).toBe(1) // substore action directly called
  expect(manager.undoQueue).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionName": "addValue",
        "inversePatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "values",
              "length",
            ],
            "value": 0,
          },
        ],
        "patches": Array [
          Object {
            "op": "add",
            "path": Array [
              "values",
              0,
            ],
            "value": 1,
          },
        ],
        "targetPath": Array [
          "substore",
        ],
      },
    ]
  `)
  manager.clearUndo()

  rootStore.addSubStoreValueDirect(2)
  expect(rootStore.substore.values).toEqual([1, 2])
  expect(manager.undoLevels).toBe(0) // no substore action called
  expect(manager.undoQueue).toMatchInlineSnapshot(`Array []`)
  manager.clearUndo()

  rootStore.addSubStoreValueIndirect(3)
  expect(rootStore.substore.values).toEqual([1, 2, 3])
  expect(manager.undoLevels).toBe(1) // substore action indirectly called
  expect(manager.undoQueue).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionName": "addValue",
        "inversePatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "values",
              "length",
            ],
            "value": 2,
          },
        ],
        "patches": Array [
          Object {
            "op": "add",
            "path": Array [
              "values",
              2,
            ],
            "value": 3,
          },
        ],
        "targetPath": Array [
          "substore",
        ],
      },
    ]
  `)
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
