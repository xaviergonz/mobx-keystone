import {
  applySnapshot,
  fromSnapshot,
  getSnapshot,
  idProp,
  Model,
  prop,
  toTreeNode,
} from "../../src"
import { testModel } from "../utils"

@testModel("EmptyIdModel")
class Item extends Model({ id: idProp, value: prop(0) }) {}

test("model construction preserves an explicitly supplied empty string ID", () => {
  expect(new Item({ id: "" }).id).toBe("")
})

test("null model IDs still use the default generator", () => {
  const item = new Item({ id: null as never })
  expect(typeof item.id).toBe("string")
  expect(item.id).not.toBe("")
})

test("snapshot reconciliation reuses moved models with empty string IDs", () => {
  const first = fromSnapshot(Item, { id: "", value: 0 })
  const second = new Item({ id: "second" })
  const root = toTreeNode([first, second])
  applySnapshot(root, [{ ...getSnapshot(second) }, { ...getSnapshot(first) }])
  expect(root[0]).toBe(second)
  expect(root[1]).toBe(first)
})
