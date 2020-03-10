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
} from "../../../src"
import "../../commonSetup"
import { autoDispose } from "../../utils"

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

  const dateNow2 = new Date(1569524561993)
  m.setDate(dateNow2)
  expect(m.date).toEqual(dateNow2)
  expect(m.time).toBe(dateNow2.toJSON())

  expect(stringAsDate.propToData(m.time)).toEqual(dateNow2)
  expect(stringAsDate.dataToProp(dateNow2)).toEqual(m.time)

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
  expect(m.time).toBe(dateNow.toJSON())
})
