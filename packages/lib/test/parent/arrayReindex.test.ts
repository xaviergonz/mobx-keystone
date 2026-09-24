import { autorun } from "mobx"
import {
  getParentPath,
  getRootPath,
  getSnapshot,
  idProp,
  Model,
  onPatches,
  type Patch,
  registerRootStore,
  rootRef,
  runUnprotected,
  toTreeNode,
  unregisterRootStore,
} from "../../src"
import { testModel } from "../utils"

test("splices reindex mixed children reactively without mutating saved paths", () => {
  const object = toTreeNode({ child: { value: 1 } })
  const nestedArray = toTreeNode([2])
  const array = toTreeNode<unknown[]>([0, null, object, nestedArray, "end"])
  const previousPath = getParentPath(object)
  const snapshot = getSnapshot(array)
  const paths: unknown[] = []
  const dispose = autorun(() => paths.push(getRootPath(object.child).path))
  const patches: Patch[] = []
  const stopPatches = onPatches(array, (p) => patches.push(...p))
  try {
    runUnprotected(() => array.splice(0, 2))
    expect(getParentPath(object)).toEqual({ parent: array, path: 0 })
    expect(getParentPath(nestedArray)).toEqual({ parent: array, path: 1 })
    expect(previousPath).toEqual({ parent: array, path: 2 })
    expect(paths).toEqual([
      [2, "child"],
      [0, "child"],
    ])

    runUnprotected(() => {
      array.unshift(false, 10, null)
      object.child.value = 2
    })
    expect(getParentPath(object)).toEqual({ parent: array, path: 3 })
    expect(getParentPath(nestedArray)).toEqual({ parent: array, path: 4 })
    expect(paths).toEqual([
      [2, "child"],
      [0, "child"],
      [3, "child"],
    ])
    expect(patches.at(-1)).toEqual({ op: "replace", path: [3, "child", "value"], value: 2 })
    expect(snapshot).toEqual([0, null, { child: { value: 1 } }, [2], "end"])
    expect(getSnapshot(array)).toEqual([false, 10, null, { child: { value: 2 } }, [2], "end"])
  } finally {
    stopPatches()
    dispose()
  }
})

test("reindexed models retain references and root-store attachment", () => {
  const attachments: string[] = []
  const detachments: string[] = []
  @testModel("ReindexItem")
  class Item extends Model({ id: idProp }) {
    onAttachedToRootStore() {
      attachments.push(this.id)
      return () => {
        detachments.push(this.id)
      }
    }
  }
  const itemRef = rootRef<Item>("arrayReindex/ItemRef")
  const first = new Item({ id: "first" })
  const second = new Item({ id: "second" })
  const root = registerRootStore(toTreeNode({ items: [first, second], ref: itemRef(second) }))
  const resolved: Item[] = []
  const dispose = autorun(() => resolved.push(root.ref.current))
  try {
    runUnprotected(() => root.items.shift())
    expect(getParentPath(second)).toEqual({ parent: root.items, path: 0 })
    expect(root.ref.current).toBe(second)
    expect(attachments).toEqual(["first", "second"])
    expect(detachments).toEqual(["first"])

    runUnprotected(() => root.items.unshift(first))
    expect(getParentPath(second)).toEqual({ parent: root.items, path: 1 })
    expect(attachments).toEqual(["first", "second", "first"])
    expect(detachments).toEqual(["first"])
    expect(resolved.every((value) => value === second)).toBe(true)
  } finally {
    dispose()
    unregisterRootStore(root)
  }
})

test("splices reindex tails spanning more than one chunk", () => {
  // Just over one 4096-item reindex chunk.
  const size = 4200
  const array = toTreeNode(Array.from({ length: size }, (_, i) => (i % 3 === 0 ? i : { i })))
  const expectPaths = () => {
    array.forEach((value, index) => {
      if (typeof value === "object") {
        // Compare the parent by identity: deep-equality on large MobX 4 arrays is very slow.
        const parentPath = getParentPath(value)
        expect(parentPath?.parent).toBe(array)
        expect(parentPath?.path).toBe(index)
      }
    })
  }

  runUnprotected(() => array.splice(1, 2))
  expect(array).toHaveLength(size - 2)
  expectPaths()

  runUnprotected(() => array.splice(5, 0, { i: -1 }, { i: -2 }, { i: -3 }))
  expect(array).toHaveLength(size + 1)
  expectPaths()
})
