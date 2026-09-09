import { LoroDoc } from "loro-crdt"
import { frozen, runUnprotected } from "mobx-keystone"
import { bindLoroToMobxKeystone, LoroTextModel } from "../../src"
import { autoDispose } from "../utils"

test("binding existing root text does not rewrite its contents", () => {
  const doc = new LoroDoc()
  const text = doc.getText("text")
  text.insert(0, "hello")
  doc.commit()
  const remove = vi.spyOn(text, "delete")
  const insert = vi.spyOn(text, "insert")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  expect(boundObject.text).toBe("hello")
  expect(remove).not.toHaveBeenCalled()
  expect(insert).not.toHaveBeenCalled()
})

test.each(["method", "property"])(
  "%s assignment of unchanged text emits no CRDT operations",
  (mode) => {
    const doc = new LoroDoc()
    const text = doc.getText("text")
    text.insert(0, "hello")
    doc.commit()
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: text,
      mobxKeystoneType: LoroTextModel,
    })
    autoDispose(dispose)
    const changes = vi.fn()
    autoDispose(doc.subscribe(changes))
    if (mode === "method") {
      boundObject.setDelta([{ insert: "hello" }])
    } else {
      runUnprotected(() => {
        boundObject.deltaList = frozen([{ insert: "hello" }])
      })
    }
    expect(boundObject.text).toBe("hello")
    expect(changes).not.toHaveBeenCalled()
  }
)

test.each(["method", "property"])(
  "unchanged %s assignment preserves concurrent insertion positions",
  (mode) => {
    const doc = new LoroDoc()
    const text = doc.getText("text")
    text.insert(0, "hello")
    doc.commit()
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: text,
      mobxKeystoneType: LoroTextModel,
    })
    autoDispose(dispose)
    const remote = doc.fork()
    remote.getText("text").insert(2, "!")
    remote.commit()
    if (mode === "method") {
      boundObject.setDelta([{ insert: "hello" }])
    } else {
      runUnprotected(() => {
        boundObject.deltaList = frozen([{ insert: "hello" }])
      })
    }
    doc.import(remote.export({ mode: "update" }))
    expect(text.toString()).toBe("he!llo")
    expect(boundObject.text).toBe("he!llo")
  }
)

test("reverted text replacements preserve concurrent insertion positions", () => {
  const doc = new LoroDoc()
  const text = doc.getText("text")
  text.insert(0, "hello")
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  const remote = doc.fork()
  remote.getText("text").insert(2, "!")
  remote.commit()
  const updates = vi.fn()
  autoDispose(doc.subscribe(updates))
  runUnprotected(() => {
    boundObject.setDelta([{ insert: "temporary" }])
    boundObject.setDelta([{ insert: "hello" }])
  })
  expect(updates).not.toHaveBeenCalled()
  doc.import(remote.export({ mode: "update" }))
  expect(boundObject.text).toBe("he!llo")
})

test("equivalent text spans do not rewrite existing content", () => {
  const doc = new LoroDoc()
  const text = doc.getText("root")
  text.insert(0, "hello")
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(binding.dispose)
  const updates = vi.fn()
  autoDispose(doc.subscribe(updates))
  binding.boundObject.setDelta([
    { insert: "he" },
    { insert: "" },
    { insert: "llo", attributes: {} },
  ])
  expect(updates).not.toHaveBeenCalled()
  expect(binding.boundObject.text).toBe("hello")
})
