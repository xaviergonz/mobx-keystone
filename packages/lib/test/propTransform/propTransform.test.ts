import { reaction } from "mobx"
import {
  ActionCall,
  applyAction,
  model,
  Model,
  modelAction,
  onActionMiddleware,
  prop,
  stringAsDate,
  timestampAsDate,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

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
  }

  const now = 0
  const dateNow = new Date(now)

  expect(timestampAsDate.propToData(now)).toStrictEqual(dateNow)
  expect(timestampAsDate.dataToProp(dateNow)).toStrictEqual(now)

  const m = new M({ timestamp: now })

  // getter
  expect(m.date instanceof Date).toBeTruthy()
  expect(m.date).toEqual(dateNow)

  // when not observed it should not be cached
  expect(m.date).not.toBe(m.date)

  const reactions: Date[] = []
  autoDispose(
    reaction(
      () => m.date,
      d => {
        reactions.push(d)
      }
    )
  )

  // when observed it should be cached
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
  expect(m.date).toEqual(dateNow2)
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

  expect(m.date).toEqual(dateNow)
  expect(m.timestamp).toBe(now)
})

test("stringAsDate", () => {
  @model("stringAsDate/M")
  class M extends Model({
    time: prop<string>(),
  }) {
    @stringAsDate("time")
    date!: Date

    @modelAction
    setDate(date: Date) {
      this.date = date
    }
  }

  const dateNow = new Date(0)

  const m = new M({ time: dateNow.toJSON() })

  // getter
  expect(m.date instanceof Date).toBeTruthy()
  expect(m.date).toEqual(dateNow)

  // when not observed it should not be cached
  expect(m.date).not.toBe(m.date)

  const reactions: Date[] = []
  autoDispose(
    reaction(
      () => m.date,
      d => {
        reactions.push(d)
      }
    )
  )

  // when observed it should be cached
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

  const dateNow2 = new Date(1569524561993)
  m.setDate(dateNow2)
  expect(m.date).toEqual(dateNow2)
  expect(m.time).toBe(dateNow2.toJSON())

  expect(stringAsDate.propToData(m.time)).toStrictEqual(dateNow2)
  expect(stringAsDate.dataToProp(dateNow2)).toStrictEqual(m.time)

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
  expect(m.time).toBe(dateNow.toJSON())
})
