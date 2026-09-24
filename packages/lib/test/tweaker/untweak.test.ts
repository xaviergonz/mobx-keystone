import { $mobx, runInAction, set } from "mobx"
import {
  detach,
  getParent,
  getSnapshot,
  isTreeNode,
  Model,
  onPatches,
  type Patch,
  prop,
  runUnprotected,
} from "../../src"
import { getMobxVersion } from "../../src/utils"
import { testModel } from "../utils"

// MobX 4 stores a new object when a detached one is assigned again
const testReattach = test.skipIf(getMobxVersion() === 4)

@testModel("untweak/Root")
class Root extends Model({ obj: prop<any>(), arr: prop<any[]>() }) {}

testReattach("detached plain objects and arrays can be changed freely, then attached again", () => {
  const root = new Root({ obj: { a: 1, inner: { b: 2 } }, arr: [{ c: 3 }] })
  const { obj, arr } = root

  const patches: Patch[] = []
  onPatches(root, (p) => patches.push(...p))

  runUnprotected(() => {
    detach(obj)
    detach(arr)
  })
  expect(isTreeNode(obj)).toBe(false)
  expect(isTreeNode(arr)).toBe(false)
  patches.length = 0

  // outside of model actions and without patches, since they are no longer tree nodes
  runInAction(() => {
    obj.a = 10
    set(obj, "inner", { b: 20 })
    set(obj, "added", [1])
    arr.push({ c: 30 })
    arr[0] = { c: 31 }
  })
  expect(patches).toEqual([])

  runUnprotected(() => {
    root.obj = obj
    root.arr = arr
  })
  expect(root.obj).toBe(obj)
  expect(root.arr).toBe(arr)
  expect(getParent(obj.inner)).toBe(obj)
  expect(getParent(obj.added)).toBe(obj)
  expect(getParent(arr[1])).toBe(arr)
  expect(getSnapshot(root.obj)).toEqual({ a: 10, inner: { b: 20 }, added: [1] })
  expect(getSnapshot(root.arr)).toEqual([{ c: 31 }, { c: 30 }])

  // attached again, so they are protected and emit each patch once
  expect(() => {
    obj.a = 11
  }).toThrow("data changes must be performed inside model actions")
  patches.length = 0
  runUnprotected(() => {
    obj.a = 11
    arr.pop()
  })
  expect(patches).toEqual([
    { op: "replace", path: ["obj", "a"], value: 11 },
    { op: "replace", path: ["arr", "length"], value: 1 },
  ])
})

// MobX 5 names these without the trailing underscore
function handlerCounts(value: object) {
  const adm = (value as any)[$mobx]
  return [
    (adm.interceptors_ ?? adm.interceptors).length,
    (adm.changeListeners_ ?? adm.changeListeners).length,
  ]
}

testReattach("attaching and detaching repeatedly does not duplicate change handling", () => {
  const root = new Root({ obj: { a: 1 }, arr: [1] })
  const { obj, arr } = root
  for (let i = 0; i < 3; i++) {
    runUnprotected(() => {
      detach(obj)
      detach(arr)
      root.obj = obj
      root.arr = arr
    })
  }

  expect(handlerCounts(obj)).toEqual([1, 1])
  expect(handlerCounts(arr)).toEqual([1, 1])

  const patches: Patch[] = []
  onPatches(root, (p) => patches.push(...p))
  runUnprotected(() => {
    obj.a = 2
    arr.push(2)
  })
  expect(patches).toEqual([
    { op: "replace", path: ["obj", "a"], value: 2 },
    { op: "add", path: ["arr", 1], value: 2 },
  ])
  expect(getSnapshot(root.obj)).toEqual({ a: 2 })
  expect(getSnapshot(root.arr)).toEqual([1, 2])
})
