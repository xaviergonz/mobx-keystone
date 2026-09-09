import { LoroDoc, type LoroEvent, LoroMovableList } from "loro-crdt"
import { Model, tProp, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { applyLoroEventToMobx } from "../../src/binding/applyLoroEventToMobx"
import { autoDispose, testModel } from "../utils"

test("list replacements preserve fixed-length refinements", () => {
  @testModel("fixed-length")
  class Root extends Model({
    values: tProp(types.refinement(types.array(types.number), (values) => values.length === 1)),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const list = root.setContainer("values", new LoroMovableList())
  list.push(1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  binding.dispose()
  let events: LoroEvent[] = []
  autoDispose(
    doc.subscribe((batch) => {
      events = batch.events
    })
  )
  list.delete(0, 1)
  list.insert(0, 2)
  doc.commit()
  expect(() => {
    for (const event of events)
      applyLoroEventToMobx(event, doc, binding.boundObject, ["root"], new Set())
  }).not.toThrow()
  expect(binding.boundObject.values.slice()).toEqual([2])
})

test("large native list insertions avoid argument limits", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  let events: LoroEvent[] = []
  autoDispose(
    doc.subscribe((batch) => {
      events = batch.events
    })
  )
  for (let i = 0; i < 150_000; i++) list.push(i)
  doc.commit()
  const target: number[] = []
  expect(() => {
    for (const event of events) applyLoroEventToMobx(event, doc, target, ["root"], new Set())
  }).not.toThrow()
  expect(target.length).toBe(150_000)
})
