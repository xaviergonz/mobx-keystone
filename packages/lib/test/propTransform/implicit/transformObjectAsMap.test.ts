import { reaction } from "mobx"
import { assert, _ } from "spec.ts"
import {
  ActionCall,
  applyAction,
  getSnapshot,
  model,
  Model,
  modelAction,
  ObjectAsMap,
  onActionMiddleware,
  SnapshotInOf,
  SnapshotOutOf,
  tProp_mapObject,
  types,
} from "../../../src"
import "../../commonSetup"
import { autoDispose } from "../../utils"

function expectSimilarMap(m1: Map<any, any>, m2: Map<any, any>) {
  expect([...m1.entries()]).toStrictEqual([...m2.entries()])
}

test("transformObjectAsMap", () => {
  @model("transformObjectAsMap/M")
  class M extends Model({
    // map: prop_mapObject(() => new Map<string, number>())
    map: tProp_mapObject(types.mapObject(types.number), () => new Map()),
  }) {
    @modelAction
    setMap(map: Map<string, number>) {
      this.map = map
    }

    @modelAction
    mapAdd(k: string, n: number) {
      this.map.set(k, n)
    }
  }

  assert(_ as SnapshotInOf<M>["map"], _ as { [k: string]: number } | null | undefined)
  assert(_ as SnapshotOutOf<M>["map"], _ as { [k: string]: number })

  const initialMap = new Map<string, number>([
    ["1", 1],
    ["2", 2],
    ["3", 3],
  ])

  const m = new M({ map: initialMap })

  expect(getSnapshot(m).map).toEqual({ 1: 1, 2: 2, 3: 3 })

  // getter
  expect(m.map instanceof ObjectAsMap).toBeTruthy()
  expectSimilarMap(m.map, initialMap)

  // should be cached
  expect(m.map).toBe(m.map)

  const reactions: Map<string, number>[] = []
  autoDispose(
    reaction(
      () => m.map,
      d => {
        reactions.push(d)
      }
    )
  )

  // do some ops
  expect(m.map.has("4")).toBe(false)
  expect(m.$.map["4"]).toBe(undefined)
  m.mapAdd("4", 4)
  expect(m.map.get("4")).toBe(4)
  expect(m.$.map["4"]).toBe(4)

  expect(reactions).toHaveLength(0) // since only the contents changed

  // should be cached
  expect(m.map).toBe(m.map)

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

  const newMap = new Map([
    ["5", 5],
    ["6", 6],
    ["7", 7],
  ])
  m.setMap(newMap)
  expect(m.map).not.toBe(newMap) // must be transformed
  expect(m.map instanceof ObjectAsMap).toBeTruthy()
  expectSimilarMap(m.map, newMap)

  expect(m.$.map).toEqual({ 5: 5, 6: 6, 7: 7 })

  expect(actionCalls).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionName": "setMap",
        "args": Array [
          Map {
            "5" => 5,
            "6" => 6,
            "7" => 7,
          },
        ],
        "targetPath": Array [],
        "targetPathIds": Array [],
      },
      Object {
        "actionName": "setMap",
        "args": Array [
          Map {
            "5" => 5,
            "6" => 6,
            "7" => 7,
          },
        ],
        "targetPath": Array [],
        "targetPathIds": Array [],
      },
    ]
  `)

  expect(reactions).toMatchInlineSnapshot(`
    Array [
      Map {
        "5" => 5,
        "6" => 6,
        "7" => 7,
      },
    ]
  `)

  // apply action should work
  applyAction(m, {
    actionName: "setMap",
    args: [initialMap],
    targetPath: [],
    targetPathIds: [],
  })

  expectSimilarMap(m.map, initialMap)
  expect(m.$.map).toEqual({ 1: 1, 2: 2, 3: 3 })
})
