import { reaction } from "mobx"
import {
  ActionCall,
  applyAction,
  model,
  Model,
  onActionMiddleware,
  prop,
  propTransform,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

test("propTransform", () => {
  const asDate = propTransform<number, Date>({
    propToData(prop) {
      return new Date(prop)
    },
    dataToProp(date) {
      return +date
    },
  })

  @model("M")
  class M extends Model({
    timestamp: prop<number>(),
  }) {
    @asDate("timestamp")
    date!: Date
  }

  const now = 0
  const dateNow = new Date(now)

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
  m.date = dateNow2
  expect(m.date).toEqual(dateNow2)
  expect(m.timestamp).toBe(now2)

  expect(actionCalls).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionName": "$propTransformSet-date",
        "args": Array [
          1569524561993,
        ],
        "targetPath": Array [],
      },
      Object {
        "actionName": "$propTransformSet-date",
        "args": Array [
          1569524561993,
        ],
        "targetPath": Array [],
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
    actionName: "$propTransformSet-date",
    args: [now],
    targetPath: [],
  })

  expect(m.date).toEqual(dateNow)
  expect(m.timestamp).toBe(now)
})
