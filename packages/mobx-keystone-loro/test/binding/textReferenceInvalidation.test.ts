import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { autorun } from "mobx"
import { Model, prop, runUnprotected, types } from "mobx-keystone"
import { bindLoroToMobxKeystone, LoroTextModel } from "../../src"
import {
  getLoroCollectionAtom,
  reportLoroCollectionObserved,
} from "../../src/utils/loroCollectionAtoms"
import { autoDispose, testModel } from "../utils"

test.each(["local", "loro"])(
  "%s scalar updates do not resolve unchanged text references",
  (source) => {
    @testModel("scalar-text-reference")
    class Root extends Model({
      count: prop(0),
      text: prop(() => LoroTextModel.withText("hello")),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    autoDispose(
      autorun(() => {
        void boundObject.text.loroText
      })
    )
    const get = vi.spyOn(LoroMap.prototype, "get")
    try {
      if (source === "local")
        runUnprotected(() => {
          boundObject.count++
        })
      else {
        root.set("count", 1)
        doc.commit()
      }
      expect(boundObject.count).toBe(1)
      expect(get.mock.calls.filter(([key]) => key === "text")).toHaveLength(0)
    } finally {
      get.mockRestore()
    }
  }
)

test("primitive array updates do not resolve unrelated text references", () => {
  @testModel("array-scalar-text-reference")
  class Root extends Model({
    values: prop<number[]>(() => [0]),
    text: prop(() => LoroTextModel.withText("hello")),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: Root,
  })
  autoDispose(dispose)
  autoDispose(
    autorun(() => {
      void boundObject.text.loroText
    })
  )
  const get = vi.spyOn(LoroMap.prototype, "get")
  try {
    runUnprotected(() => {
      boundObject.values[0] = 1
    })
    expect(root.toJSON().values).toEqual([1])
    expect(get.mock.calls.filter(([key]) => key === "text")).toHaveLength(0)
  } finally {
    get.mockRestore()
  }
})

test.each(["local", "loro"])(
  "%s container replacements do not resolve unrelated text paths",
  (source) => {
    @testModel("container-text-reference")
    class Root extends Model({
      values: prop<number[]>(() => [0]),
      text: prop(() => LoroTextModel.withText("hello")),
    }) {}
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: Root,
    })
    autoDispose(dispose)
    autoDispose(
      autorun(() => {
        void boundObject.text.loroText
      })
    )
    const get = vi.spyOn(LoroMap.prototype, "get")
    try {
      if (source === "local")
        runUnprotected(() => {
          boundObject.values = [1, 2]
        })
      else {
        const list = root.setContainer("values", new LoroMovableList())
        list.push(1)
        list.push(2)
        doc.commit()
      }
      expect(boundObject.values).toEqual([1, 2])
      expect(get.mock.calls.filter(([key]) => key === "text")).toHaveLength(0)
    } finally {
      get.mockRestore()
    }
  }
)

test("text path key dependencies are released when unobserved", () => {
  @testModel("released-text-reference")
  class Root extends Model({ text: prop(() => LoroTextModel.withText("hello")) }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const stop = autorun(() => {
    void binding.boundObject.text.loroText
  })
  expect(getLoroCollectionAtom(root, root.id, "text")).toBeDefined()
  stop()
  expect(getLoroCollectionAtom(root, root.id, "text")).toBeUndefined()
})

test("net-zero list edits do not invalidate contained text paths", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("root")
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: types.array(LoroTextModel),
  })
  autoDispose(binding.dispose)
  runUnprotected(() => {
    binding.boundObject.push(LoroTextModel.withText("hello"))
  })
  const text = binding.boundObject[0]
  autoDispose(
    autorun(() => {
      void text.loroText
    })
  )
  const get = vi.spyOn(LoroMovableList.prototype, "get")
  autoDispose(() => get.mockRestore())
  list.insert(0, 0)
  list.delete(0, 1)
  doc.commit()
  expect(get).not.toHaveBeenCalled()
  expect(text.text).toBe("hello")
})

test("collection reads only allocate atoms while a derivation is tracking", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")

  // Writing to Loro happens outside any derivation, where an atom would be dead
  // weight and reading the native container id would be wasted work.
  reportLoroCollectionObserved(root, root, "value")
  expect(getLoroCollectionAtom(root, root.id, "value")).toBeUndefined()

  let tracked: unknown
  const stop = autorun(() => {
    reportLoroCollectionObserved(root, root, "value")
    tracked = getLoroCollectionAtom(root, root.id, "value")
  })
  expect(tracked).toBeDefined()

  // The atom stays cached while observed, then is dropped once nothing tracks it.
  reportLoroCollectionObserved(root, root, "value")
  expect(getLoroCollectionAtom(root, root.id, "value")).toBe(tracked)
  stop()
  expect(getLoroCollectionAtom(root, root.id, "value")).toBeUndefined()
})
