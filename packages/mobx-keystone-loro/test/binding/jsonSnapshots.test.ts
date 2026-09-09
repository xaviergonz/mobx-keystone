import { LoroDoc } from "loro-crdt"
import { configure } from "mobx"
import { getSnapshot, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose } from "../utils"

test("new keys are observable without proxies", () => {
  configure({ useProxies: "never" })
  try {
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: types.record(types.number),
    })
    autoDispose(binding.dispose)
    root.set("added", 1)
    doc.commit()
    expect(getSnapshot(binding.boundObject)).toEqual({ added: 1 })
  } finally {
    configure({ useProxies: "always" })
  }
})

test.each(["valueOf", "toString", "constructor"])("binding accepts the JSON key %s", (key) => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  root.set(key, 1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: types.record(types.number),
  })
  autoDispose(binding.dispose)
  root.set(key, 2)
  doc.commit()
  expect(getSnapshot(binding.boundObject)).toEqual({ [key]: 2 })
})
