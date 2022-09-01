import {
  actionCallToReduxAction,
  asReduxStore,
  getSnapshot,
  Model,
  modelAction,
  prop,
  ReduxAction,
  ReduxMiddleware,
  SnapshotOutOfModel,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("P")
export class P extends Model({
  x: prop(() => 0),
}) {
  @modelAction
  addX(n: number) {
    this.x += n
    return this.x
  }
}

describe("asReduxStore", () => {
  test("no middlewares", () => {
    const p = new P({})
    const store = asReduxStore(p)

    expect(store.getState()).toBe(getSnapshot(p))

    const events: { sn: SnapshotOutOfModel<P>; prevSn: SnapshotOutOfModel<P> }[] = []
    const disposer = store.subscribe((sn, prevSn) => {
      events.push({
        sn,
        prevSn,
      })
    })
    autoDispose(disposer)

    const action = actionCallToReduxAction({
      actionName: "addX",
      args: [5],
      targetPath: [],
      targetPathIds: [],
    })

    const dispatched = store.dispatch(action)
    expect(dispatched).toBe(action)

    expect(p.x).toBe(5)
    expect(store.getState()).toBe(getSnapshot(p))

    expect(events).toMatchInlineSnapshot(`
      [
        {
          "prevSn": {
            "$modelType": "P",
            "x": 0,
          },
          "sn": {
            "$modelType": "P",
            "x": 5,
          },
        },
      ]
    `)
  })

  test("with middlewares", () => {
    const p = new P({})

    const tweakAction = (action: ReduxAction, fn: (val: number) => number) => {
      return {
        ...action,
        payload: {
          ...action.payload,
          args: [fn(action.payload.args[0])],
        },
      }
    }

    const mware1: ReduxMiddleware<P> = () => (next) => (action) => {
      return tweakAction(next(tweakAction(action, (x) => x * 2)), (x) => x * 100)
    }

    const mware2: ReduxMiddleware<P> = () => (next) => (action) => {
      return tweakAction(next(tweakAction(action, (x) => x + 2)), (x) => x + 100)
    }

    const store = asReduxStore(p, mware1, mware2)

    expect(store.getState()).toBe(getSnapshot(p))

    const events: { sn: SnapshotOutOfModel<P>; prevSn: SnapshotOutOfModel<P> }[] = []
    const disposer = store.subscribe((sn, prevSn) => {
      events.push({
        sn,
        prevSn,
      })
    })
    autoDispose(disposer)

    const action = actionCallToReduxAction({
      actionName: "addX",
      args: [5],
      targetPath: [],
      targetPathIds: [],
    })

    const dispatched = store.dispatch(action)
    expect(dispatched).not.toBe(action)

    // first mware multiplies, second adds
    expect(p.x).toBe(5 * 2 + 2)

    // 11200 because 12 -> 12 + 100 = 112 -> 112 * 100 = 11200
    expect(dispatched).toMatchInlineSnapshot(`
      {
        "payload": {
          "actionName": "addX",
          "args": [
            11200,
          ],
          "targetPath": [],
          "targetPathIds": [],
        },
        "type": "applyAction",
      }
    `)

    expect(store.getState()).toBe(getSnapshot(p))

    expect(events).toMatchInlineSnapshot(`
      [
        {
          "prevSn": {
            "$modelType": "P",
            "x": 0,
          },
          "sn": {
            "$modelType": "P",
            "x": 12,
          },
        },
      ]
    `)
  })
})
