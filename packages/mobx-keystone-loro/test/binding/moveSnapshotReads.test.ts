import { LoroDoc } from "loro-crdt"
import * as tree from "mobx-keystone"
import { bindLoroToMobxKeystone, moveWithinArray } from "../../src"
import { autoDispose } from "../utils"

test.each([false, true])(
  "consecutive moves share their snapshot checkpoint (reentrant: %s)",
  (reentrant) => {
    const doc = new LoroDoc()
    const list = doc.getMovableList("root")
    for (let i = 0; i < 100; i++) list.push(i)
    doc.commit()
    const binding = bindLoroToMobxKeystone({
      loroDoc: doc,
      loroObject: list,
      mobxKeystoneType: tree.types.array(tree.types.number),
    })
    autoDispose(binding.dispose)
    const snapshot = vi.spyOn(tree, "getSnapshot")
    autoDispose(() => snapshot.mockRestore())
    const moveItems = () => {
      for (let i = 0; i < 50; i++)
        moveWithinArray(binding.boundObject, 0, binding.boundObject.length)
    }
    if (reentrant)
      autoDispose(
        tree.onDeepChange(binding.boundObject, (change) => {
          if (change.type === tree.DeepChangeType.ArraySplice && change.addedValues[0] === 100)
            moveItems()
        })
      )
    tree.runUnprotected(() => {
      if (reentrant) binding.boundObject.push(100)
      else moveItems()
    })
    const rootReads = snapshot.mock.calls.filter(([node]) => node === binding.boundObject)
    expect(rootReads.length).toBeLessThanOrEqual(5)
    expect(list.toArray()).toEqual([
      ...Array.from({ length: reentrant ? 51 : 50 }, (_, i) => i + 50),
      ...Array.from({ length: 50 }, (_, i) => i),
    ])
  }
)
