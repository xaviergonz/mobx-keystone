import { LoroDoc, type LoroMap, LoroMovableList } from "loro-crdt"
import { onReactionError } from "mobx"
import {
  DeepChangeType,
  getSnapshot,
  idProp,
  Model,
  onDeepChange,
  runUnprotected,
  tProp,
  types,
} from "mobx-keystone"
import { bindLoroToMobxKeystone, moveWithinArray } from "../../src"
import { autoDispose, testModel } from "../utils"

function bindItems(name: string) {
  @testModel(`${name}-child`)
  class Child extends Model({ id: idProp, value: tProp(0) }) {}
  @testModel(`${name}-root`)
  class Root extends Model({
    items: tProp(types.array(types.or(types.number, Child)), () => [
      new Child({ id: "a", value: 1 }),
      new Child({ id: "b", value: 2 }),
      new Child({ id: "c", value: 3 }),
    ]),
    count: tProp(0),
  }) {}
  const doc = new LoroDoc()
  const root = doc.getMap("root")
  const binding = bindLoroToMobxKeystone({ loroDoc: doc, loroObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const errors: unknown[] = []
  autoDispose(onReactionError((error) => errors.push(error)))
  return {
    Child,
    doc,
    root,
    errors,
    boundObject: binding.boundObject,
    list: root.get("items") as LoroMovableList,
  }
}

test.each([
  // Return values are unused; annotating void also keeps `as const` from
  // making these three differing return types circular to infer.
  [
    "move",
    (items: unknown[]): void => {
      moveWithinArray(items, 2, 0)
    },
  ],
  [
    "splice",
    (items: unknown[]): void => {
      items.splice(2, 1)
    },
  ],
  [
    "update",
    (items: unknown[]): void => {
      items[2] = 9
    },
  ],
] as const)("a local %s stays synchronized after a pending native deletion", (_, edit) => {
  const { boundObject, errors, list, root } = bindItems(`pending-delete-${_}`)
  list.delete(0, 1)
  runUnprotected(() => {
    edit(boundObject.items)
    boundObject.count++
  })
  expect(errors).toEqual([])
  expect(boundObject.count).toBe(1)
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})

test("a local push stays synchronized after a pending native deletion", () => {
  const { boundObject, Child, errors, list, root } = bindItems("pending-delete-push")
  list.delete(0, 1)
  runUnprotected(() => {
    boundObject.items.push(new Child({ id: "d", value: 4 }))
    boundObject.count++
  })
  expect(errors).toEqual([])
  expect(boundObject.count).toBe(1)
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})

test("a local move and field edit stay synchronized after a pending native reorder", () => {
  const { boundObject, Child, errors, list, root } = bindItems("pending-reorder")
  runUnprotected(() => {
    boundObject.items.splice(0, 3, 95, new Child({ id: "n", value: 82 }))
  })
  list.move(1, 0)
  runUnprotected(() => {
    moveWithinArray(boundObject.items, 1, 0)
    ;(boundObject.items[0] as InstanceType<typeof Child>).value = 71
    boundObject.count++
  })
  expect(errors).toEqual([])
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})

test("a native commit during a reentrant move keeps both sides synchronized", () => {
  const { boundObject, errors, doc, list, root } = bindItems("reentrant-move-commit")
  autoDispose(
    onDeepChange(boundObject, (change) => {
      if (change.type !== DeepChangeType.ObjectUpdate || change.key !== "count") return
      moveWithinArray(boundObject.items, 0, 3)
      list.push(99)
      doc.commit()
    })
  )
  runUnprotected(() => {
    boundObject.count++
  })
  expect(errors).toEqual([])
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})

test("an unrelated pending native map edit keeps local list writes incremental", () => {
  const { boundObject, errors, root } = bindItems("pending-map-edit")
  const insert = vi.spyOn(LoroMovableList.prototype, "insert")
  autoDispose(() => insert.mockRestore())
  root.set("count", 5)
  runUnprotected(() => {
    boundObject.items.push(7)
  })
  expect(errors).toEqual([])
  expect(insert).toHaveBeenCalledTimes(1)
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})

test("a pending native field edit still replays an explicit move natively", () => {
  const { boundObject, errors, list, root } = bindItems("pending-field-move")
  const move = vi.spyOn(LoroMovableList.prototype, "move")
  autoDispose(() => move.mockRestore())
  ;(list.get(1) as LoroMap).set("value", 9)
  runUnprotected(() => {
    moveWithinArray(boundObject.items, 0, 3)
    boundObject.count++
  })
  expect(errors).toEqual([])
  expect(move).toHaveBeenCalledExactlyOnceWith(0, 2)
  expect(root.toJSON()).toEqual(getSnapshot(boundObject))
})
