import {
  getSnapshot,
  model,
  Model,
  modelAction,
  modelFlow,
  prop,
  UndoEvent,
  UndoManager,
  undoMiddleware,
  UndoStore,
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
}

@model("R")
class R extends Model({
  undoData: prop(() => new UndoStore({})),
  p: prop(() => new P({})),
}) {}

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
            "$",
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
            "$",
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
            "$",
            "p",
            "$",
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
                "p2",
                "y",
              ],
              "value": 10,
            },
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 3,
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
            "$",
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

  // doesn't record after disposing
  manager.dispose()
  p.incX(200)
  expectUndoRedoToBe(0, 0)
})

@model("P2Flow")
class P2Flow extends Model({
  y: prop(() => 0),
}) {
  @modelFlow
  *incY(n: number) {
    yield* Promise.resolve()
    this.y += n
    yield* Promise.resolve()
  }
}

@model("PFlow")
class PFlow extends Model({
  x: prop(() => 0),
  p2: prop(() => new P2Flow({})),
}) {
  @modelFlow
  *incX(n: number) {
    yield* Promise.resolve()
    this.x += n
    yield* Promise.resolve()
  }

  @modelFlow
  *incXY(x: number, y: number) {
    yield* Promise.resolve()
    yield* this.incX(x)
    yield* Promise.resolve()
    yield* this.p2.incY(y)
    yield* Promise.resolve()
    throw new Error("incXY")
  }
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
            "$",
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
            "$",
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
            "$",
            "p",
            "$",
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
                "p2",
                "y",
              ],
              "value": 10,
            },
            Object {
              "op": "replace",
              "path": Array [
                "p",
                "x",
              ],
              "value": 3,
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
            "$",
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
