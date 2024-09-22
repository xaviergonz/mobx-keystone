import {
  addActionMiddleware,
  applyAction,
  applyDelete,
  BuiltInAction,
  Model,
  prop,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("P")
class P extends Model({
  obj: prop<Record<string, number> | undefined>(undefined),
}) {}

test("applyDelete", () => {
  const events: any[] = []

  const p = new P({ obj: { a: 1, b: 2 } })

  autoDispose(
    addActionMiddleware({
      subtreeRoot: p,
      middleware(ctx, next) {
        events.push({
          event: "action started",
          ctx,
        })
        const result = next()
        events.push({
          event: "action finished",
          ctx,
          result,
        })
        return result
      },
    })
  )
  expect(events.length).toBe(0)

  expect(p.obj!.a).toBe(1)
  expect(p.obj!.b).toBe(2)
  expect(Object.keys(p.obj!)).toEqual(["a", "b"])
  applyDelete(p.obj!, "a")
  expect(p.obj!.a).toBe(undefined)
  expect(p.obj!.b).toBe(2)
  expect(Object.keys(p.obj!)).toEqual(["b"])

  expect(events).toMatchInlineSnapshot(`
    [
      {
        "ctx": {
          "actionName": "$$applyDelete",
          "args": [
            "a",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "b": 2,
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "$$applyDelete",
          "args": [
            "a",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "b": 2,
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
    ]
  `)

  // apply action should work
  applyAction(p.obj!, {
    actionName: BuiltInAction.ApplyDelete,
    args: ["b"],
    targetPath: [],
    targetPathIds: [],
  })

  expect(p.obj!.b).toBe(undefined)
  expect(Object.keys(p.obj!)).toEqual([])
})
