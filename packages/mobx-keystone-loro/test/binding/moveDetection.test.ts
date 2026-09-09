import { LoroDoc, LoroMovableList } from "loro-crdt"
import * as tree from "mobx-keystone"
import { bindLoroToMobxKeystone, moveWithinArray } from "../../src"
import { autoDispose } from "../utils"

test("local array changes use their reported target without resolving paths", () => {
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const list = root.setContainer("items", new LoroMovableList())
  list.push(1)
  list.push(2)
  doc.commit()
  const { boundObject, dispose } = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: root,
    mobxKeystoneType: tree.types.record(tree.types.array(tree.types.number)),
  })
  autoDispose(dispose)
  const resolve = vi.spyOn(tree, "resolvePath")
  try {
    tree.runUnprotected(() => {
      boundObject.items.push(3)
      moveWithinArray(boundObject.items, 0, 3)
    })
    expect(boundObject.items).toEqual([2, 3, 1])
    expect(list.toArray()).toEqual([2, 3, 1])
    expect(resolve).not.toHaveBeenCalled()
  } finally {
    resolve.mockRestore()
  }
})

test("equal-value listener splices do not duplicate a native move", () => {
  const doc = new LoroDoc()
  const list = doc.getMovableList("items")
  list.push(1)
  list.push(1)
  doc.commit()
  const binding = bindLoroToMobxKeystone({
    loroDoc: doc,
    loroObject: list,
    mobxKeystoneType: tree.types.array(tree.types.number),
  })
  autoDispose(binding.dispose)
  list.set(0, 9)
  let nested = false
  autoDispose(
    tree.onDeepChange(binding.boundObject, () => {
      if (!nested) {
        nested = true
        binding.boundObject.splice(0, 2, 1, 1)
      }
    })
  )
  const move = vi.spyOn(list, "move")
  try {
    tree.runUnprotected(() => moveWithinArray(binding.boundObject, 0, 2))
    expect(move).toHaveBeenCalledTimes(1)
    expect(list.toArray()).toEqual([1, 9])
    expect(binding.boundObject.slice()).toEqual([1, 9])
  } finally {
    move.mockRestore()
  }
})
