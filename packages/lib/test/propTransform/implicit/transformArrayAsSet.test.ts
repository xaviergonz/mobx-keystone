import { computed, isObservableSet, reaction } from "mobx"
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
  tProp_setArray,
  types,
} from "../../../src"
import "../../commonSetup"
import { autoDispose } from "../../utils"

function expectSimilarSet(s1: Set<any>, s2: Set<any>) {
  expect([...s1.values()]).toStrictEqual([...s2.values()])
}

test("transformArrayAsSet", () => {
  @model("transformArrayAsSet/M")
  class M extends Model({
    // set: prop_setArray(
    //   () => new Set<number>([10, 20, 30])
    // ),

    set: tProp_setArray(types.setArray(types.number), () => new Set([10, 20, 30])),
  }) {
    @modelAction
    setSet(set: Set<number>) {
      this.set = set
    }

    @modelAction
    setAdd(n: number) {
      this.set.add(n)
    }

    @computed
    get has1() {
      return this.set.has(1)
    }

    @modelAction
    delete(val: number) {
      return this.set.delete(val)
    }
  }

  assert(_ as SnapshotInOf<M>["set"], _ as number[] | null | undefined)
  assert(_ as SnapshotOutOf<M>["set"], _ as number[])

  const m2 = new M({})
  expect(getSnapshot(m2).set).toEqual([10, 20, 30])

  const initialSet = new Set<number>([1, 2, 3])

  const m = new M({ set: initialSet })

  // check it can be used in computeds when observed and not accessed first
  const has1Events: boolean[] = []
  reaction(
    () => m.has1,
    (v) => {
      has1Events.push(v)
    }
  )
  expect(m.has1).toBe(true)
  expect(has1Events).toHaveLength(0)

  expect(getSnapshot(m).set).toEqual([1, 2, 3])

  // getter
  expect(isObservableSet(m.set)).toBeTruthy()
  expectSimilarSet(m.set, initialSet)

  // should be cached
  expect(m.set).toBe(m.set)

  const reactions: Set<number>[] = []
  autoDispose(
    reaction(
      () => m.set,
      (d) => {
        expect(isObservableSet(d)).toBeTruthy()
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
  expect(m.set).not.toBe(newSet) // must be transformed
  expect(isObservableSet(m.set)).toBeTruthy()
  expectSimilarSet(m.set, newSet)

  expect(m.$.set).toEqual([5, 6, 7])

  expect(has1Events).toEqual([false])
  has1Events.length = 0

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
      Array [
        5,
        6,
        7,
      ],
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

  expect(has1Events).toEqual([true])
  has1Events.length = 0

  // check intercept doesn't mess up return values
  expect(m.set.has(1)).toBe(true)

  expect(m.delete(1)).toBe(true)
  expect(m.set.has(1)).toBe(false)

  expect(m.delete(1)).toBe(false)
  expect(m.set.has(1)).toBe(false)
})
