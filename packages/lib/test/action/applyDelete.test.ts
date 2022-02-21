import {
  addActionMiddleware,
  applyAction,
  applyDelete,
  BuiltInAction,
  model,
  Model,
  prop,
} from "../../src"
import { autoDispose } from "../utils"

@model("P")
export class P extends Model({
  obj: prop<{ [k: string]: number } | undefined>(undefined),
}) {}

test("applyDelete", () => {
  const events: any = []

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
    Array [
      Object {
        "ctx": Object {
          "actionName": "$$applyDelete",
          "args": Array [
            "a",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "b": 2,
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "$$applyDelete",
          "args": Array [
            "a",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
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
