import { LoroDoc, LoroMap } from "loro-crdt"
import { getSnapshot, runUnprotected, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose } from "../utils"

test("editing separate roots in one action does not serialize either root", () => {
  const doc = new LoroDoc()
  const left = doc.getMap("left")
  const right = doc.getMap("right")
  left.set("value", 0)
  right.set("value", 0)
  doc.commit()
  const bind = (root: LoroMap) => {
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: types.record(types.number),
    })
    autoDispose(binding.dispose)
    return binding.boundObject
  }
  const leftModel = bind(left)
  const rightModel = bind(right)
  const entries = vi.spyOn(LoroMap.prototype, "entries")
  try {
    runUnprotected(() => {
      leftModel.value = 1
      rightModel.value = 2
    })
    expect(getSnapshot(leftModel)).toEqual(left.toJSON())
    expect(getSnapshot(rightModel)).toEqual(right.toJSON())
    expect(leftModel.value).toBe(1)
    expect(rightModel.value).toBe(2)
    expect(entries).not.toHaveBeenCalled()
  } finally {
    entries.mockRestore()
  }
})

test("a commit touching both roots still reconciles pending list edits", () => {
  const doc = new LoroDoc()
  const left = doc.getMovableList("left")
  const right = doc.getMovableList("right")
  const leftBinding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: left,
    mobxKeystoneType: types.array(types.number),
  })
  const rightBinding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: right,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(leftBinding.dispose)
  autoDispose(rightBinding.dispose)
  left.push(10)
  right.push(20)
  runUnprotected(() => {
    leftBinding.boundObject.push(1)
    rightBinding.boundObject.push(2)
  })
  expect(getSnapshot(leftBinding.boundObject)).toEqual(left.toJSON())
  expect(getSnapshot(rightBinding.boundObject)).toEqual(right.toJSON())
  expect([...leftBinding.boundObject].sort((a, b) => a - b)).toEqual([1, 10])
  expect([...rightBinding.boundObject].sort((a, b) => a - b)).toEqual([2, 20])
})
