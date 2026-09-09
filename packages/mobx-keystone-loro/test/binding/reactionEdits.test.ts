import { LoroDoc } from "loro-crdt"
import { reaction } from "mobx"
import { getSnapshot, runUnprotected, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, LoroTextModel } from "../../src"
import { autoDispose } from "../utils"

test.each(["direct", "import"])("text reactions can append edits after a %s update", (mode) => {
  const doc = new LoroDoc()
  const text = doc.getText("text")
  text.insert(0, "a")
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  autoDispose(
    reaction(
      () => boundObject.text,
      (value) => {
        if (value === "ab") boundObject.insertText(2, "!")
      }
    )
  )
  const source = mode === "direct" ? doc : doc.fork()
  source.getText("text").insert(1, "b")
  source.commit()
  if (source !== doc) doc.import(source.export({ mode: "update" }))
  expect(boundObject.text).toBe("ab!")
  expect(text.toString()).toBe("ab!")
  if (source !== doc) {
    source.import(doc.export({ mode: "update" }))
    expect(source.getText("text").toString()).toBe("ab!")
  }
})

test.each(["direct", "import"])("list reactions can append edits after a %s update", (mode) => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("items")
  list.push(1)
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(types.number),
  })
  autoDispose(dispose)
  autoDispose(
    reaction(
      () => boundObject.length,
      (length) => {
        if (length === 2)
          runUnprotected(() => {
            boundObject.push(3)
          })
      }
    )
  )
  const source = mode === "direct" ? doc : doc.fork()
  source.getMovableList("items").push(2)
  source.commit()
  if (source !== doc) doc.import(source.export({ mode: "update" }))
  expect(getSnapshot(boundObject)).toEqual([1, 2, 3])
  expect(list.toArray()).toEqual([1, 2, 3])
  if (source !== doc) {
    source.import(doc.export({ mode: "update" }))
    expect(source.getMovableList("items").toArray()).toEqual([1, 2, 3])
  }
})

test("disposing inside a text reaction keeps subsequent edits local", () => {
  const doc = new LoroDoc()
  const text = doc.getText("text")
  text.insert(0, "a")
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: text,
    mobxKeystoneType: LoroTextModel,
  })
  autoDispose(dispose)
  autoDispose(
    reaction(
      () => boundObject.text,
      (value) => {
        if (value === "ab") {
          dispose()
          boundObject.insertText(2, "!")
        }
      }
    )
  )
  text.insert(1, "b")
  doc.commit()
  expect(boundObject.text).toBe("ab!")
  expect(text.toString()).toBe("ab")
  text.insert(2, "c")
  doc.commit()
  expect(boundObject.text).toBe("ab!")
  expect(text.toString()).toBe("abc")
})
