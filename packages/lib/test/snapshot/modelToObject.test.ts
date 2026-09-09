import { applySnapshot, getSnapshot, Model, model, prop, toTreeNode } from "../../src"

@model("modelToObject/Item")
class Item extends Model({ value: prop(1) }) {}

test.each(["object", "array"])("a model in an %s can be replaced by a plain snapshot", (kind) => {
  const item = new Item({})
  const before = getSnapshot(item)
  if (kind === "array") {
    const root = toTreeNode<(Item | { value: number })[]>([item])
    applySnapshot(root, [{ value: 2 }])
    expect(root[0]).not.toBeInstanceOf(Item)
    expect(getSnapshot(root)).toEqual([{ value: 2 }])
  } else {
    const root = toTreeNode<{ item: Item | { value: number } }>({ item })
    applySnapshot(root, { item: { value: 2 } })
    expect(root.item).not.toBeInstanceOf(Item)
    expect(getSnapshot(root)).toEqual({ item: { value: 2 } })
  }
  expect(getSnapshot(item)).toEqual(before)
})
