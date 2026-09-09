import { LoroDoc, LoroText } from "loro-crdt"
import { applyDeltaToLoroText } from "../../src/binding/convertJsonToLoroData"

test.each(["attached", "detached"])(
  "%s adjacent text spans use one insertion while preserving formatting offsets",
  (kind) => {
    const doc = new LoroDoc()
    doc.configTextStyle({ bold: { expand: "after" } })
    const text = kind === "attached" ? doc.getText("text") : new LoroText()
    const insert = vi.spyOn(text, "insert")
    const delta = Array.from({ length: 100 }, (_, index) => ({
      insert: index % 2 === 0 ? "😀" : "x",
      attributes: { bold: index % 2 === 0 },
    }))
    applyDeltaToLoroText(text, delta)
    expect(text.toDelta()).toEqual(delta)
    expect(insert).toHaveBeenCalledTimes(1)
  }
)

test("text insertions retain their positions around retain and delete operations", () => {
  const text = new LoroText()
  text.insert(0, "abcd")
  applyDeltaToLoroText(text, [
    { retain: 1 },
    { insert: "x" },
    { insert: "y" },
    { delete: 1 },
    { retain: 1 },
    { insert: "!" },
  ])
  expect(text.toString()).toBe("axyc!d")
})
