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
  tProp,
  transformStringAsDate,
  types,
} from "../../../src"
import "../../commonSetup"
import { autoDispose } from "../../utils"

test("transformStringAsDate", () => {
  @model("transformStringAsDate/M")
  class M extends Model({
    date: transformStringAsDate(tProp(types.string)),
  }) {
    @modelAction
    setDate(date: Date) {
      this.date = date
    }
  }

  assert(_ as SnapshotInOf<M>["date"], _ as string)
  assert(_ as SnapshotOutOf<M>["date"], _ as string)

  const dateNow = new Date(0)

  const m = new M({ date: dateNow })

  expect(getSnapshot(m).date).toBe(dateNow.toJSON())

  // getter
  expect(m.date instanceof Date).toBeTruthy()
  expect(m.date).toBe(dateNow) // same instance

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
  expect(m.date).toBe(dateNow2)
  expect(m.$.date).toBe(dateNow2.toJSON())

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
  expect(m.$.date).toBe(dateNow.toJSON())
})
