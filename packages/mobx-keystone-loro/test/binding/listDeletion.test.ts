import { LoroDoc } from "loro-crdt"
import { observable } from "mobx"
import type { Path } from "mobx-keystone"
import { applyLoroEventToMobx } from "../../src/binding/applyLoroEventToMobx"
import { autoDispose } from "../utils"

test("list deletion reuses the removed values without copying the range first", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("items")
  const target = observable.array(
    Array.from({ length: 1000 }, (_, index) => index),
    { deep: false }
  )
  for (const value of target) list.push(value)
  doc.commit()
  const slice = vi.spyOn(target, "slice")
  autoDispose(
    doc.subscribe((batch) => {
      for (const event of batch.events) {
        applyLoroEventToMobx(event, event.path.slice(1) as Path, doc, target, new Set())
      }
    })
  )
  list.delete(100, 800)
  list.insert(100, -1)
  doc.commit()
  expect(target).toEqual(list.toArray())
  expect(slice).not.toHaveBeenCalled()
})
