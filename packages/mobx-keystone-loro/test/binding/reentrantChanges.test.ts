import { LoroDoc, type LoroMovableList } from "loro-crdt"
import {
  DeepChangeType,
  getSnapshot,
  Model,
  onDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each(["object", "array", "splice"])("child listeners preserve reentrant %s edits", (kind) => {
  @testModel("reentrant-child")
  class Child extends Model({
    value: tProp(0),
    values: tProp(types.array(types.number), () => [0]),
  }) {}
  @testModel("reentrant-root")
  class Root extends Model({ child: tProp(Child, () => new Child({})), untouched: tProp(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const child = binding.boundObject.child
  autoDispose(
    onDeepChange(kind === "object" ? child : child.values, (change) => {
      if (change.type === DeepChangeType.ObjectUpdate && change.newValue === 1) child.value = 2
      if (change.type === DeepChangeType.ArrayUpdate && change.newValue === 1) child.values[0] = 2
      if (change.type === DeepChangeType.ArraySplice && change.addedValues[0] === 1)
        child.values.push(2)
    })
  )
  runUnprotected(() => {
    if (kind === "object") child.value = 1
    else if (kind === "array") child.values[0] = 1
    else child.values.push(1)
  })
  if (kind === "splice") expect(child.values.slice()).toEqual([0, 1, 2])
  else expect(kind === "object" ? child.value : child.values[0]).toBe(2)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("reentrant local edits retain unrelated pending native edits", () => {
  @testModel("reentrant-pending-root")
  class Root extends Model({
    values: tProp(types.array(types.number), () => [0, 0]),
    untouched: tProp(0),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  autoDispose(
    onDeepChange(binding.boundObject.values, (change) => {
      if (change.type === DeepChangeType.ArrayUpdate && change.newValue === 1)
        binding.boundObject.values[0] = 2
    })
  )
  root.set("untouched", 9)
  ;(root.get("values") as LoroMovableList).set(1, 8)
  runUnprotected(() => {
    binding.boundObject.values[0] = 1
  })
  expect(binding.boundObject.untouched).toBe(9)
  expect(binding.boundObject.values.slice()).toEqual([2, 8])
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})

test("reentrant edits restored to their original value emit no native updates", () => {
  @testModel("reentrant-restored-root")
  class Root extends Model({ value: tProp(0), untouched: tProp(0) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const updates = vi.fn()
  autoDispose(doc.subscribe(updates))
  autoDispose(
    onDeepChange(binding.boundObject, (change) => {
      if (
        change.type === DeepChangeType.ObjectUpdate &&
        change.key === "value" &&
        change.newValue === 1
      )
        binding.boundObject.value = 0
    })
  )
  runUnprotected(() => {
    binding.boundObject.value = 1
  })
  expect(binding.boundObject.value).toBe(0)
  expect(updates).not.toHaveBeenCalled()
  runUnprotected(() => {
    binding.boundObject.untouched = 1
  })
  expect(updates).toHaveBeenCalledTimes(1)
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
