import { LoroDoc, LoroMap } from "loro-crdt"
import { applyJsonArrayToLoroMovableList } from "../../src"

test.each([10, { value: 10 }])(
  "a merged replacement follows a concurrent move: %j",
  (replacement) => {
    const doc = new LoroDoc()
    const list = doc.getMovableList("items")
    list.push(1)
    list.push(2)
    list.push(3)
    doc.commit()
    const remote = doc.fork()
    remote.getMovableList("items").move(0, 2)
    remote.commit()

    applyJsonArrayToLoroMovableList(list, [replacement, 2, 3], { mode: "merge" })
    doc.commit()
    doc.import(remote.export({ mode: "update" }))
    expect(list.toJSON()).toEqual([2, 3, replacement])
    remote.import(doc.export({ mode: "update" }))
    expect(remote.getMovableList("items").toJSON()).toEqual([2, 3, replacement])
  }
)

test("merging a primitive over a container preserves its list position identity", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("items")
  list.pushContainer(new LoroMap()).set("value", 1)
  list.push(2)
  doc.commit()
  const remote = doc.fork()
  remote.getMovableList("items").move(0, 1)
  remote.commit()
  applyJsonArrayToLoroMovableList(list, [10, 2], { mode: "merge" })
  doc.commit()
  doc.import(remote.export({ mode: "update" }))
  expect(list.toJSON()).toEqual([2, 10])
})
