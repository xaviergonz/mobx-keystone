import { reaction } from "mobx"
import { assert, _ } from "spec.ts"
import {
  ActionCall,
  applyAction,
  ArrayAsSet,
  getSnapshot,
  model,
  Model,
  modelAction,
  onActionMiddleware,
  prop,
  SnapshotInOf,
  SnapshotOutOf,
  transformArrayAsSet,
} from "../../../src"
import "../../commonSetup"
import { autoDispose } from "../../utils"

function expectSimilarSet(s1: Set<any>, s2: Set<any>) {
  expect([...s1.values()]).toStrictEqual([...s2.values()])
}

test("transformArrayAsSet", () => {
  @model("transformArrayAsSet/M")
  class M extends Model({
    set: transformArrayAsSet(
      prop<number[]>(() => [])
    ),
  }) {
    @modelAction
    setSet(set: Set<number>) {
      this.set = set
    }

    @modelAction
    setAdd(n: number) {
      this.set.add(n)
    }
  }

  assert(_ as SnapshotInOf<M>["set"], _ as number[] | null | undefined)
  assert(_ as SnapshotOutOf<M>["set"], _ as number[])

  const initialSet = new Set<number>([1, 2, 3])

  const m = new M({ set: initialSet })

  expect(getSnapshot(m).set).toEqual([1, 2, 3])

  // getter
  expect(m.set instanceof ArrayAsSet).toBeTruthy()
  expectSimilarSet(m.set, initialSet)

  // should be cached
  expect(m.set).toBe(m.set)

  const reactions: Set<number>[] = []
  autoDispose(
    reaction(
      () => m.set,
      d => {
        reactions.push(d)
      }
    )
  )

  // do some ops
  expect(m.set.has(4)).toBe(false)
  expect(m.$.set.includes(4)).toBe(false)
  m.setAdd(4)
  expect(m.set.has(4)).toBe(true)
  expect(m.$.set.includes(4)).toBe(true)

  expect(reactions).toHaveLength(0) // since only the contents changed

  // should be cached
  expect(m.set).toBe(m.set)

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

  const newSet = new Set([5, 6, 7])
  m.setSet(newSet)
  expectSimilarSet(m.set, newSet)

  expect(m.$.set).toEqual([5, 6, 7])

  expect(actionCalls).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionName": "setSet",
        "args": Array [
          Set {
            5,
            6,
            7,
          },
        ],
        "targetPath": Array [],
        "targetPathIds": Array [],
      },
      Object {
        "actionName": "setSet",
        "args": Array [
          Set {
            5,
            6,
            7,
          },
        ],
        "targetPath": Array [],
        "targetPathIds": Array [],
      },
    ]
  `)

  expect(reactions).toMatchInlineSnapshot(`
    Array [
      Set {
        5,
        6,
        7,
      },
    ]
  `)

  // apply action should work
  applyAction(m, {
    actionName: "setSet",
    args: [initialSet],
    targetPath: [],
    targetPathIds: [],
  })

  expectSimilarSet(m.set, initialSet)
  expect(m.$.set).toEqual([...initialSet.values()])
})
