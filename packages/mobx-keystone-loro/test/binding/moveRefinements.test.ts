import { LoroDoc } from "loro-crdt"
import { getSnapshot, Model, runUnprotected, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, moveWithinArray } from "../../src"
import { autoDispose, testModel } from "../utils"

test("moves validate fixed-length refinements against the complete result", () => {
  @testModel("fixed-length-move-root")
  class Root extends Model({
    items: tProp(
      types.refinement(types.array(types.number), (values) => values.length === 3),
      () => [1, 2, 3]
    ),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  runUnprotected(() => moveWithinArray(binding.boundObject.items, 0, 3))
  expect(binding.boundObject.items.slice()).toEqual([2, 3, 1])
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("rejected moves preserve the original array and native state", () => {
  @testModel("ordered-move-root")
  class Root extends Model({
    items: tProp(
      types.refinement(types.array(types.number), (values) =>
        values.every((value, index) => index === 0 || value > values[index - 1])
      ),
      () => [1, 2, 3]
    ),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const changed = vi.fn()
  autoDispose(doc.subscribe(changed))
  expect(() => runUnprotected(() => moveWithinArray(binding.boundObject.items, 0, 3))).toThrow()
  expect(binding.boundObject.items.slice()).toEqual([1, 2, 3])
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
  expect(changed).not.toHaveBeenCalled()
  runUnprotected(() => binding.boundObject.items.push(4))
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("atomic moves retain the local plain-object references", () => {
  @testModel("local-reference-move-root")
  class Root extends Model({
    items: tProp(types.array(types.object(() => ({ value: types.number }))), () => [
      { value: 1 },
      { value: 2 },
      { value: 3 },
    ]),
  }) {}
  const root = new Root({})
  const original = root.items.slice()
  runUnprotected(() => moveWithinArray(root.items, 0, 3))
  expect(root.items[0]).toBe(original[1])
  expect(root.items[1]).toBe(original[2])
  expect(root.items[2]).toBe(original[0])
})

test("large observable moves avoid variadic argument limits", () => {
  const length = 150000
  @testModel("large-atomic-move-root")
  class Root extends Model({
    items: tProp(types.refinement(types.array(types.number), (values) => values.length === length)),
  }) {}
  const root = new Root({ items: Array.from({ length }, (_, index) => index) })
  runUnprotected(() => moveWithinArray(root.items, 0, length))
  expect(root.items.length).toBe(length)
  expect(root.items[0]).toBe(1)
  expect(root.items[length - 1]).toBe(0)
})
