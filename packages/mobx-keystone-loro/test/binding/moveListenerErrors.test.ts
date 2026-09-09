import { LoroDoc, type LoroMap, type LoroMovableList } from "loro-crdt"
import {
  type DeepChange,
  DeepChangeType,
  getSnapshot,
  Model,
  onDeepChange,
  onGlobalDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import { bindLoroToMobxKeystone, moveWithinArray } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([
  ["none", "subtree"],
  ["move", "subtree"],
  ["inverse", "subtree"],
  ["none", "global"],
  ["move", "global"],
  ["inverse", "global"],
] as const)("moves survive errors after %s nested moves in a %s listener", (kind, listenerKind) => {
  @testModel("nested-move-root")
  class Root extends Model({
    items: tProp(types.array(types.object(() => ({ value: types.number }))), () => [
      { value: 1 },
      { value: 2 },
      { value: 3 },
    ]),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(binding.dispose)
  const list = root.get("items") as LoroMovableList
  const original = list.toArray() as LoroMap[]
  original[0].set("value", 9)
  let nested = false
  const subscribe = (listener: (change: DeepChange) => void) =>
    listenerKind === "global"
      ? onGlobalDeepChange((target, change) => {
          if (target === binding.boundObject.items) listener(change)
        })
      : onDeepChange(binding.boundObject.items, listener)
  autoDispose(
    subscribe((change) => {
      if (change.type === DeepChangeType.ArraySplice && !nested) {
        nested = true
        if (kind !== "none") moveWithinArray(binding.boundObject.items, kind === "move" ? 1 : 2, 0)
        throw new Error("listener failed")
      }
    })
  )
  expect(() => runUnprotected(() => moveWithinArray(binding.boundObject.items, 0, 3))).toThrow(
    "listener failed"
  )
  const order = kind === "none" ? [1, 2, 0] : kind === "move" ? [2, 1, 0] : [0, 1, 2]
  expect(list.toArray().map((item) => (item as LoroMap).id)).toEqual(
    order.map((i) => original[i].id)
  )
  expect(binding.boundObject.items.map((item) => item.value)).toEqual(
    order.map((i) => [9, 2, 3][i])
  )
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  runUnprotected(() => moveWithinArray(binding.boundObject.items, 0, 3))
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
