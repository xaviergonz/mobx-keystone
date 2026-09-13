import { clone, fromSnapshot, getSnapshot, Model, model, prop } from "../../src"

@model("")
class EmptyName extends Model({ value: prop(1) }) {}

test("models with an empty type name can be restored and cloned", () => {
  const item = new EmptyName({ value: 2 })
  const snapshot = getSnapshot(item)
  expect(snapshot.$modelType).toBe("")
  expect(fromSnapshot<EmptyName>(snapshot)).toBeInstanceOf(EmptyName)
  expect(clone(item).value).toBe(2)
})

test("an explicitly supplied empty model type name is not treated as missing", () => {
  const item = fromSnapshot<EmptyName>({ $modelType: "", value: 3 })
  expect(item).toBeInstanceOf(EmptyName)
  expect(item.value).toBe(3)
})
