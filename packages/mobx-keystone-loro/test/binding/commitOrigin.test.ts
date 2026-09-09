import { LoroDoc } from "loro-crdt"
import { Model, prop, runUnprotected, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, loroBindingContext } from "../../src"
import { autoDispose, testModel } from "../utils"

test("a failed model write does not hide the next direct Loro commit", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  root.set("value", 1)
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(dispose)
  const set = vi.spyOn(root, "set").mockImplementation(() => {
    throw new Error("write failed")
  })
  try {
    expect(() =>
      runUnprotected(() => {
        boundObject.value = 2
        loroBindingContext.get(boundObject)!.flushPendingChanges!()
      })
    ).toThrow("write failed")
  } finally {
    set.mockRestore()
  }
  root.set("value", 3)
  doc.commit()
  expect(boundObject.value).toBe(3)
})

test("failed initialization preserves the caller's next commit origin", () => {
  @testModel("origin-initialization")
  class Root extends Model({ value: prop(1) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  doc.setNextCommitOrigin("caller")
  const set = vi.spyOn(root, "set").mockImplementation(() => {
    throw new Error("initialization failed")
  })
  try {
    expect(() =>
      bindLoroToMobxKeystone({
        loroDoc: doc,
        loroObject: root,
        mobxKeystoneType: Root,
      })
    ).toThrow("initialization failed")
  } finally {
    set.mockRestore()
  }
  const origins: (string | undefined)[] = []
  autoDispose(
    doc.subscribe((batch) => {
      origins.push(batch.origin)
    })
  )
  root.set("value", 3)
  doc.commit()
  expect(origins).toEqual(["caller"])
})
