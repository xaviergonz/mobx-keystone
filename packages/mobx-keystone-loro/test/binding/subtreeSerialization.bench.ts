import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { types } from "mobx-keystone"
import { test } from "vitest"
import { bindLoroToMobxKeystone } from "../../src"
import { convertLoroDataToJson } from "../../src/binding/convertLoroDataToJson"
import type { PlainValue } from "../../src/plainTypes"

// Capture the function once so the reference loop excludes module-runner getter overhead.
const convert = convertLoroDataToJson
const list = new LoroMovableList()
for (let i = 0; i < 10000; i++) list.push(i)

test("list conversion", async ({ bench }) => {
  const indexed = bench("per-index conversion of 10,000 values", () => {
    const result: PlainValue[] = []
    for (let i = 0; i < list.length; i++) {
      result.push(convert(list.get(i) as PlainValue))
    }
    return result
  })
  const bulk = bench("bulk conversion of 10,000 values", () => convert(list))
  await bench.compare(indexed, bulk, { time: 1000, warmupTime: 300 })
})

test("subtree insertion", async ({ bench }) => {
  const result = await bench("insert 1,000 nested maps into a binding", () => {
    const doc = new LoroDoc()
    const root = doc.getMap("root")
    const { dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: types.record(types.array(types.record(types.number))),
    })
    const items = root.setContainer("items", new LoroMovableList())
    for (let i = 0; i < 1000; i++) items.pushContainer(new LoroMap()).set("value", i)
    doc.commit()
    dispose()
  }).run({ time: 1000, warmupTime: 300 })
  console.info(`${result.name}: ${result.latency.mean.toFixed(3)} ms/op`)
})
