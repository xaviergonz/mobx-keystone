import { LoroDoc, LoroMovableList, LoroText } from "loro-crdt"
import { reaction } from "mobx"
import { types } from "mobx-keystone"
import { bindLoroToMobxKeystone, LoroTextModel } from "../../src"
import { autoDispose } from "../utils"

test.each(["direct", "import"])(
  "reactions observe multi-text %s transactions atomically",
  (mode) => {
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    root.setContainer("first", new LoroText()).insert(0, "a")
    root.setContainer("second", new LoroText()).insert(0, "b")
    doc.commit()
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: types.record(LoroTextModel),
    })
    autoDispose(dispose)
    const states: string[] = []
    autoDispose(
      reaction(
        () => boundObject.first.text + boundObject.second.text,
        (value) => states.push(value),
        { fireImmediately: true }
      )
    )
    const source = mode === "direct" ? doc : doc.fork()
    const sourceRoot = source.getMap("root")
    ;(sourceRoot.get("first") as LoroText).insert(1, "1")
    ;(sourceRoot.get("second") as LoroText).insert(1, "2")
    source.commit()
    if (source !== doc) doc.import(source.export({ mode: "update" }))
    expect(states).toEqual(["ab", "a1b2"])
  }
)

test.each(["direct", "import"])(
  "reactions observe mixed-container %s transactions atomically",
  (mode) => {
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    root.set("count", 0)
    root.setContainer("values", new LoroMovableList()).push(1)
    root.setContainer("text", new LoroText()).insert(0, "a")
    doc.commit()
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: types.unchecked<{ count: number; values: number[]; text: LoroTextModel }>(),
    })
    autoDispose(dispose)
    const states: string[] = []
    autoDispose(
      reaction(
        () => `${boundObject.count}:${boundObject.values.join(",")}:${boundObject.text.text}`,
        (value) => states.push(value),
        { fireImmediately: true }
      )
    )
    const source = mode === "direct" ? doc : doc.fork()
    const sourceRoot = source.getMap("root")
    sourceRoot.set("count", 1)
    ;(sourceRoot.get("values") as LoroMovableList).push(2)
    ;(sourceRoot.get("text") as LoroText).insert(1, "b")
    source.commit()
    if (source !== doc) doc.import(source.export({ mode: "update" }))
    expect(states).toEqual(["0:1:a", "1:1,2:ab"])
  }
)
