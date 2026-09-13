import {
  applySnapshot,
  clone,
  getSnapshot,
  getSnapshotModelTypeAndId,
  idProp,
  Model,
  modelIdKey,
  prop,
  toTreeNode,
} from "../../src"
import { testModel } from "../utils"

@testModel("EmptyIdProperty")
class Item extends Model({ "": idProp, value: prop(0) }) {}

test("empty-string ID property names receive generated IDs", () => {
  const item = new Item({})
  expect(typeof item[""]).toBe("string")
  expect(item[modelIdKey]).toBe(item[""])
})

test("empty-string ID properties are recognized in snapshot metadata", () => {
  const item = new Item({ "": "first" })
  expect(getSnapshotModelTypeAndId(getSnapshot(item))?.modelId).toBe("first")
})

test("cloning regenerates IDs stored under an empty property name", () => {
  const item = new Item({ "": "first" })
  expect(clone(item)[""]).not.toBe("first")
})

test("snapshot reconciliation preserves identities with empty ID property names", () => {
  const first = new Item({ "": "first" })
  const second = new Item({ "": "second" })
  const root = toTreeNode([first, second])
  applySnapshot(root, [
    { ...getSnapshot(second), value: 2 },
    { ...getSnapshot(first), value: 1 },
  ])
  expect(root[0]).toBe(second)
  expect(root[1]).toBe(first)
})

test("applying a different empty-property ID to a model is rejected", () => {
  const item = new Item({ "": "first" })
  expect(() => applySnapshot(item, { ...getSnapshot(item), "": "second" })).toThrow(/id/)
})
