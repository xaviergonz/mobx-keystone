import {
  getSnapshot,
  model,
  Model,
  modelAction,
  UndoEvent,
  UndoManager,
  undoMiddleware,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P2")
class P2 extends Model {
  data = {
    y: 0,
  }

  @modelAction
  incY(n: number) {
    this.data.y += n
  }
}

@model("P")
class P extends Model {
  data = {
    x: 0,
    p2: new P2(),
  }

  @modelAction
  incX(n: number) {
    this.data.x += n
  }

  @modelAction
  incXY(x: number, y: number) {
    this.incX(x)
    this.data.p2.incY(y)
  }
}

test("undoMiddleware", () => {
  const p = new P()

  const manager = undoMiddleware(p)
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

  p.data.p2.incY(10)
  snapshots.push(getSnapshot(p))

  p.incXY(3, 20)
  snapshots.push(getSnapshot(p))

  expect(p.data.x).toBe(1 + 2 + 3)
  expect(p.data.p2.data.y).toBe(10 + 20)

  expectUndoRedoToBe(4, 0)
  expect(getEvents()).toMatchInlineSnapshot(`
    Object {
      "redo": Array [],
      "undo": Array [
        Object {
          "actionName": "incX",
          "inversePathes": Array [
            Object {
              "op": "replace",
              "path": Array [
                "x",
              ],
              "value": 0,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "x",
              ],
              "value": 1,
            },
          ],
          "targetPath": Array [],
        },
        Object {
          "actionName": "incX",
          "inversePathes": Array [
            Object {
              "op": "replace",
              "path": Array [
                "x",
              ],
              "value": 1,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "x",
              ],
              "value": 3,
            },
          ],
          "targetPath": Array [],
        },
        Object {
          "actionName": "incY",
          "inversePathes": Array [
            Object {
              "op": "replace",
              "path": Array [
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
                "p2",
                "y",
              ],
              "value": 10,
            },
          ],
          "targetPath": Array [
            "data",
            "p2",
          ],
        },
        Object {
          "actionName": "incXY",
          "inversePathes": Array [
            Object {
              "op": "replace",
              "path": Array [
                "p2",
                "y",
              ],
              "value": 10,
            },
            Object {
              "op": "replace",
              "path": Array [
                "x",
              ],
              "value": 3,
            },
          ],
          "patches": Array [
            Object {
              "op": "replace",
              "path": Array [
                "x",
              ],
              "value": 6,
            },
            Object {
              "op": "replace",
              "path": Array [
                "p2",
                "y",
              ],
              "value": 30,
            },
          ],
          "targetPath": Array [],
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
