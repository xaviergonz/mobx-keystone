import { LoroDoc, LoroMovableList } from "loro-crdt"
import * as mobxKeystone from "mobx-keystone"
import { getSnapshot, Model, TypeCheckErrorFailure, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test.each([1, 2])("binding recovers after %s invalid native commits", (failures) => {
  @testModel("recovery-root")
  class Root extends Model({
    values: tProp(types.refinement(types.array(types.number), (values) => values.length === 2)),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const values = root.setContainer("values", new LoroMovableList())
  values.push(1)
  values.push(2)
  doc.commit()
  // Capture callback errors explicitly; Loro otherwise reports them across its
  // WASM callback boundary rather than throwing them from commit().
  const errors: unknown[] = []
  const subscribe = doc.subscribe.bind(doc)
  const spy = vi.spyOn(doc, "subscribe").mockImplementation((callback) =>
    subscribe((batch) => {
      try {
        callback(batch)
      } catch (error) {
        errors.push(error)
      }
    })
  )
  autoDispose(() => spy.mockRestore())
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  for (let i = 0; i < failures; i++) {
    values.push(3 + i)
    doc.commit()
    expect(errors).toHaveLength(i + 1)
    expect(errors[i]).toBeInstanceOf(TypeCheckErrorFailure)
    expect(getSnapshot(binding.boundObject.values)).toEqual([1, 2])
  }
  values.delete(0, failures)
  doc.commit()
  expect(errors).toHaveLength(failures)
  expect(getSnapshot(binding.boundObject.values)).toEqual(values.toArray())
  const apply = vi.spyOn(mobxKeystone, "applySnapshot")
  autoDispose(() => apply.mockRestore())
  values.set(0, 9)
  doc.commit()
  expect(errors).toHaveLength(failures)
  expect(getSnapshot(binding.boundObject.values)).toEqual(values.toArray())
  expect(apply).not.toHaveBeenCalled()
})

test("local corrections recover other fields from a rejected native commit", () => {
  @testModel("local-recovery-root")
  class Root extends Model({
    values: tProp(types.refinement(types.array(types.number), (values) => values.length === 2)),
    flag: tProp(0),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const values = root.setContainer("values", new LoroMovableList())
  values.push(1)
  values.push(2)
  doc.commit()
  const errors: unknown[] = []
  const subscribe = doc.subscribe.bind(doc)
  const spy = vi.spyOn(doc, "subscribe").mockImplementation((callback) =>
    subscribe((batch) => {
      try {
        callback(batch)
      } catch (error) {
        errors.push(error)
      }
    })
  )
  autoDispose(() => spy.mockRestore())
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  root.set("flag", 1)
  values.push(3)
  doc.commit()
  expect(errors).toHaveLength(1)
  expect(errors[0]).toBeInstanceOf(TypeCheckErrorFailure)
  expect(binding.boundObject.flag).toBe(0)
  mobxKeystone.runUnprotected(() => {
    binding.boundObject.values = [9, 10]
  })
  expect(errors).toHaveLength(1)
  expect(binding.boundObject.flag).toBe(1)
  expect(getSnapshot(binding.boundObject)).toEqual(root.toJSON())
})
