import { reaction } from "mobx"
import { assert, _ } from "spec.ts"
import {
  ActionCall,
  applyAction,
  getSnapshot,
  model,
  Model,
  modelAction,
  onActionMiddleware,
  SnapshotInOf,
  SnapshotOutOf,
  timestampAsDate,
  tProp_dateTimestamp,
  types,
} from "../../../src"
import "../../commonSetup"
import { autoDispose } from "../../utils"

test("transformTimestampAsDate", () => {
  @model("transformTimestampAsDate/M")
  class M extends Model({
    // date: prop_dateTimestamp<Date>(),
    date: tProp_dateTimestamp(types.dateTimestamp),
  }) {
    @modelAction
    setDate(date: Date) {
      this.date = date
    }

    @modelAction
    setTimestamp(timestamp: number) {
      this.$.date = timestamp
    }
  }

  assert(_ as SnapshotInOf<M>["date"], _ as number)
  assert(_ as SnapshotOutOf<M>["date"], _ as number)

  const now = 0
  const dateNow = new Date(now)

  const m = new M({ date: dateNow })

  expect(getSnapshot(m).date).toBe(now)

  // getter
  expect(m.date instanceof Date).toBeTruthy()
  expect(m.date).toEqual(dateNow) // not same instance, transformation will generate a new one

  // should be cached
  expect(m.date).toBe(m.date)

  const reactions: Date[] = []
  autoDispose(
    reaction(
      () => m.date,
      d => {
        reactions.push(d)
      }
    )
  )

  // should be cached
  expect(m.date).toBe(m.date)

  // setter
  const actionCalls: ActionCall[] = []
  autoDispose(
    onActionMiddleware(m, {
      onStart(actionCall) {
        actionCalls.push(actionCall)
      },
      onFinish(actionCall) {
        actionCalls.push(actionCall)
      },
    })
  )

  const now2 = 1569524561993
  const dateNow2 = new Date(now2)

  expect(timestampAsDate.propToData(now2)).toEqual(dateNow2)
  expect(timestampAsDate.dataToProp(dateNow2)).toEqual(now2)

  m.setDate(dateNow2)
  expect(m.date).toEqual(dateNow2)
  expect(m.$.date).toBe(now2)

  expect(actionCalls).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionName": "setDate",
        "args": Array [
          2019-09-26T19:02:41.993Z,
        ],
        "targetPath": Array [],
        "targetPathIds": Array [],
      },
      Object {
        "actionName": "setDate",
        "args": Array [
          2019-09-26T19:02:41.993Z,
        ],
        "targetPath": Array [],
        "targetPathIds": Array [],
      },
    ]
  `)

  expect(reactions).toMatchInlineSnapshot(`
                        Array [
                          2019-09-26T19:02:41.993Z,
                        ]
            `)

  // apply action should work
  applyAction(m, {
    actionName: "setDate",
    args: [dateNow],
    targetPath: [],
    targetPathIds: [],
  })

  expect(m.date).toEqual(dateNow)
  expect(m.$.date).toBe(now)

  // changing the date to be the same should keep the cached value intact
  reactions.length = 0
  m.setDate(dateNow)
  expect(m.date).toEqual(dateNow)
  expect(reactions).toHaveLength(0)

  // changing the backed value to be the same should keep the cached value intact
  reactions.length = 0
  m.setTimestamp(now)
  expect(m.date).toEqual(dateNow)
  expect(reactions).toHaveLength(0)

  // changing the backed prop and trying to set the same data back should work
  m.setTimestamp(5000)
  m.setDate(dateNow)
  expect(m.$.date).toBe(now)

  // changing the backed prop should change the other, and it should react
  reactions.length = 0
  m.setTimestamp(10000)
  expect(m.date).not.toBe(dateNow)
  expect(+m.date).toBe(10000)
  expect(reactions).toMatchInlineSnapshot(`
    Array [
      1970-01-01T00:00:10.000Z,
    ]
  `)
})
