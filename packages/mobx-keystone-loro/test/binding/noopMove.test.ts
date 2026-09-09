import { LoroDoc } from "loro-crdt"
import { onDeepChange, runUnprotected, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, moveWithinArray } from "../../src"
import { autoDispose } from "../utils"

test.each([0, 1, 2])("moving item %i before its next neighbor does not mutate the tree", (from) => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("items")
  for (const value of [1, 2, 3]) list.push(value)
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  const changed = vi.fn()
  autoDispose(onDeepChange(boundObject, changed))
  runUnprotected(() => moveWithinArray(boundObject, from, from + 1))
  expect(boundObject).toEqual([1, 2, 3])
  expect(list.toArray()).toEqual([1, 2, 3])
  expect(changed).not.toHaveBeenCalled()
})
