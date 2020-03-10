import {
  addActionMiddleware,
  applyAction,
  applyMethodCall,
  BuiltInAction,
  deserializeActionCall,
  model,
  Model,
  prop,
  serializeActionCall,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P")
export class P extends Model({
  arr: prop<number[]>(() => []),
}) {}

test("applyCall", () => {
  const events: any = []

  const p = new P({ arr: [1, 2, 3] })

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

  expect(applyMethodCall(p.arr, "push", 4, 5)).toBe(p.arr.length)
  expect(p.arr).toEqual([1, 2, 3, 4, 5])

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "$$applyMethodCall",
          "args": Array [
            "push",
            Array [
              4,
              5,
            ],
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Array [
            1,
            2,
            3,
            4,
            5,
          ],
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "$$applyMethodCall",
          "args": Array [
            "push",
            Array [
              4,
              5,
            ],
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Array [
            1,
            2,
            3,
            4,
            5,
          ],
          "type": "sync",
        },
        "event": "action finished",
        "result": 5,
      },
    ]
  `)

  // apply action should work
  const act = {
    actionName: BuiltInAction.ApplyMethodCall,
    args: ["push", 6, 7],
    targetPath: [],
    targetPathIds: [],
  }

  const serAct = serializeActionCall(act, p.arr)
  const desAct = deserializeActionCall(serAct, p.arr)

  const ret = applyAction(p.arr, desAct)
  expect(p.arr).toEqual([1, 2, 3, 4, 5, 6, 7])
  expect(ret).toBe(p.arr.length)
})
