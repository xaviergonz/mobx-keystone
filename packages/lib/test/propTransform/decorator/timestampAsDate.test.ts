import { reaction } from "mobx"
import {
  ActionCall,
  applyAction,
  model,
  Model,
  modelAction,
  onActionMiddleware,
  prop,
  timestampAsDate,
} from "../../../src"
import "../../commonSetup"
import { autoDispose } from "../../utils"

test("timestampAsDate", () => {
  @model("timestampAsDate/M")
  class M extends Model({
    timestamp: prop<number>(),
  }) {
    @timestampAsDate("timestamp")
    date!: Date

    @modelAction
    setDate(date: Date) {
      this.date = date
    }

    @modelAction
    setTimestamp(timestamp: number) {
      this.timestamp = timestamp
    }
  }

  const now = 0
  const dateNow = new Date(now)

  expect(timestampAsDate.propToData(now)).toStrictEqual(dateNow)
  expect(timestampAsDate.dataToProp(dateNow)).toStrictEqual(now)

  const m = new M({ timestamp: now })

  // getter
  expect(m.date instanceof Date).toBeTruthy()
  expect(m.date).toEqual(dateNow) // created from backed prop

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

  expect(timestampAsDate.propToData(now2)).toStrictEqual(dateNow2)
  expect(timestampAsDate.dataToProp(dateNow2)).toStrictEqual(now2)

  m.setDate(dateNow2)
  expect(m.date).toBe(dateNow2)
  expect(m.timestamp).toBe(now2)

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

  expect(m.date).toEqual(dateNow) // created from backed prop
  expect(m.timestamp).toBe(now)

  // changing the date to be the same should keep the cached value intact
  reactions.length = 0
  m.setDate(dateNow)
  expect(m.date).toBe(dateNow)
  expect(reactions).toHaveLength(0)

  // changing the backed value to be the same should keep the cached value intact
  reactions.length = 0
  m.setTimestamp(now)
  expect(m.date).toEqual(dateNow) // created from backed prop
  expect(reactions).toHaveLength(0)

  // changing the backed prop and trying to set the same data back should work
  m.setTimestamp(5000)
  m.setDate(dateNow)
  expect(m.timestamp).toBe(now)

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
