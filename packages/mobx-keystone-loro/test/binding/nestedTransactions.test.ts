import { LoroDoc, LoroMap, LoroMovableList } from "loro-crdt"
import { getSnapshot, types } from "mobx-keystone"
import { bindLoroToMobxKeystone } from "../../src"
import { autoDispose } from "../utils"

test.each([7, 12345, 987654])(
  "nested container transactions stay synchronized (seed %i)",
  (seed) => {
    const doc = new LoroDoc()
    const root = doc.getMovableList("root")
    const { boundObject, dispose } = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: root,
      mobxKeystoneType: types.array(types.record(types.array(types.number))),
    })
    autoDispose(dispose)
    const remote = doc.fork()
    const items = remote.getMovableList("root")
    let state = seed
    const random = (max: number) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state % max
    }
    for (let batch = 0; batch < 100; batch++) {
      for (let op = 0; op < 10; op++) {
        const kind = random(7)
        if (items.length === 0 || kind === 0) {
          const item = items.insertContainer(random(items.length + 1), new LoroMap())
          const values = item.setContainer("values", new LoroMovableList())
          values.push(random(100))
          values.push(random(100))
        } else if (kind === 1) {
          items.move(random(items.length), random(items.length))
        } else if (kind === 2) {
          items.delete(random(items.length), 1)
        } else {
          const item = items.get(random(items.length)) as LoroMap
          if (kind === 3) {
            const values = item.setContainer("values", new LoroMovableList())
            values.push(random(100))
          } else if (kind === 4) {
            item.delete("values")
          } else {
            let values = item.get("values") as LoroMovableList | undefined
            values ??= item.setContainer("values", new LoroMovableList())
            if (kind === 5 || values.length === 0)
              values.insert(random(values.length + 1), random(100))
            else values.set(random(values.length), random(100))
          }
        }
      }
      remote.commit()
      doc.import(remote.export({ mode: "update" }))
      expect(getSnapshot(boundObject), `batch ${batch}`).toEqual(items.toJSON())
      expect(root.toJSON()).toEqual(items.toJSON())
    }
  }
)
