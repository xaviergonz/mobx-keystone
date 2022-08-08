import { draft, Draft, getSnapshot, Model, modelAction, prop, SnapshotOutOf } from "../../src"
import { testModel } from "../utils"

@testModel("M")
class M extends Model({
  x: prop(1),
  y: prop(10),
  z: prop<number | undefined>(),
  child: prop<M | undefined>(),
}) {
  @modelAction
  setX(val: number) {
    this.x = val
  }

  @modelAction
  setY(val: number) {
    this.y = val
  }

  @modelAction
  setZ(val: number | undefined) {
    this.z = val
  }

  @modelAction
  setChild(val: M | undefined) {
    this.child = val
  }
}

let p!: M
let pSn!: () => SnapshotOutOf<M>
let d!: Draft<M>

function expectDirty() {
  expect(d.isDirty).toBe(true)
  expect(getSnapshot(d.data)).not.toEqual(pSn())
}

function expectNotDirty() {
  expect(d.isDirty).toBe(false)
  expect(d.isDirtyByPath(["x"])).toBe(false)
  expect(d.isDirtyByPath(["y"])).toBe(false)
  expect(d.isDirtyByPath(["z"])).toBe(false)
  expect(d.isDirtyByPath(["child"])).toBe(false)
  expect(getSnapshot(d.data)).toEqual(pSn())
}

beforeEach(() => {
  p = new M({ child: new M({}) })
  pSn = () => getSnapshot(p)
  d = draft(p)
})

test("creation", () => {
  expect(d.data).not.toBe(p)
  expect(d.originalData).toBe(p)

  expectNotDirty()
})

test("commit without changes", () => {
  d.commit()
  expectNotDirty()
})

test("reset without changes", () => {
  d.reset()
  expectNotDirty()
})

test("reset changes", () => {
  d.data.setX(2)
  d.data.setChild(undefined)
  expect(d.data.x).toBe(2)
  expect(d.data.child).toBeUndefined()
  expect(d.originalData.x).toBe(1)
  expect(d.originalData.child).toBeDefined()
  expectDirty()

  d.reset()
  expect(d.data.x).toBe(1)
  expect(d.data.child).toBeDefined()
  expect(d.originalData.x).toBe(1)
  expect(d.originalData.child).toBeDefined()
  expectNotDirty()
})

test("reset when original changes", () => {
  d.originalData.setX(2)
  d.originalData.setChild(undefined)
  expect(d.data.x).toBe(1)
  expect(d.data.child).toBeDefined()
  expect(d.originalData.x).toBe(2)
  expect(d.originalData.child).toBeUndefined()
  expectDirty()

  d.reset()
  expect(d.data.x).toBe(2)
  expect(d.data.child).toBeUndefined()
  expect(d.originalData.x).toBe(2)
  expect(d.originalData.child).toBeUndefined()
  expectNotDirty()
})

test("commit changes", () => {
  d.data.setX(2)
  d.data.setChild(undefined)
  expect(d.data.x).toBe(2)
  expect(d.data.child).toBeUndefined()
  expect(d.originalData.x).toBe(1)
  expect(d.originalData.child).toBeDefined()
  expectDirty()

  d.commit()
  expect(d.data.x).toBe(2)
  expect(d.data.child).toBeUndefined()
  expect(d.originalData.x).toBe(2)
  expect(d.originalData.child).toBeUndefined()
  expectNotDirty()
})

test("resetByPath", () => {
  d.data.setX(2)
  d.data.setY(20)
  d.data.setZ(200)
  d.data.setChild(undefined)

  expect(d.data.x).toBe(2)
  expect(d.data.y).toBe(20)
  expect(d.data.z).toBe(200)
  expect(d.data.child).toBeUndefined()

  expect(d.originalData.x).toBe(1)
  expect(d.originalData.y).toBe(10)
  expect(d.originalData.z).toBe(undefined)
  expect(d.originalData.child).toBeDefined()

  expect(d.isDirtyByPath(["x"])).toBe(true)
  expect(d.isDirtyByPath(["y"])).toBe(true)
  expect(d.isDirtyByPath(["z"])).toBe(true)
  expect(d.isDirtyByPath(["child"])).toBe(true)
  expectDirty()

  d.resetByPath(["x"])
  d.resetByPath(["z"])
  d.resetByPath(["child"])

  expect(d.data.x).toBe(1)
  expect(d.data.y).toBe(20)
  expect(d.data.z).toBe(undefined)
  expect(d.data.child).toBeDefined()

  expect(d.originalData.x).toBe(1)
  expect(d.originalData.y).toBe(10)
  expect(d.originalData.z).toBe(undefined)
  expect(d.originalData.child).toBeDefined()

  expect(d.isDirtyByPath(["x"])).toBe(false)
  expect(d.isDirtyByPath(["y"])).toBe(true)
  expect(d.isDirtyByPath(["z"])).toBe(false)
  expect(d.isDirtyByPath(["child"])).toBe(false)
  expectDirty() // y is still dirty
})

test("commitByPath", () => {
  d.data.setX(2)
  d.data.setY(20)
  d.data.setZ(200)
  d.data.setChild(undefined)

  expect(d.data.x).toBe(2)
  expect(d.data.y).toBe(20)
  expect(d.data.z).toBe(200)
  expect(d.data.child).toBeUndefined()

  expect(d.originalData.x).toBe(1)
  expect(d.originalData.y).toBe(10)
  expect(d.originalData.z).toBe(undefined)
  expect(d.originalData.child).toBeDefined()

  expect(d.isDirtyByPath(["x"])).toBe(true)
  expect(d.isDirtyByPath(["y"])).toBe(true)
  expect(d.isDirtyByPath(["z"])).toBe(true)
  expect(d.isDirtyByPath(["child"])).toBe(true)
  expectDirty()

  d.commitByPath(["x"])
  d.commitByPath(["z"])
  d.commitByPath(["child"])

  expect(d.data.x).toBe(2)
  expect(d.data.y).toBe(20)
  expect(d.data.z).toBe(200)
  expect(d.data.child).toBeUndefined()

  expect(d.originalData.x).toBe(2)
  expect(d.originalData.y).toBe(10)
  expect(d.originalData.z).toBe(200)
  expect(d.originalData.child).toBeUndefined()

  expect(d.isDirtyByPath(["x"])).toBe(false)
  expect(d.isDirtyByPath(["y"])).toBe(true)
  expect(d.isDirtyByPath(["z"])).toBe(false)
  expect(d.isDirtyByPath(["child"])).toBe(false)
  expectDirty() // y is still dirty
})

test("drafts of drafts (1)", () => {
  d.data.setX(10)

  const dd = draft(d.data)
  dd.data.setX(100)

  expect(p.x).toBe(1)
  expect(d.data.x).toBe(10)
  expect(dd.data.x).toBe(100)
  expect(d.isDirty).toBe(true)
  expect(dd.isDirty).toBe(true)

  dd.commit()
  expect(p.x).toBe(1)
  expect(d.data.x).toBe(100)
  expect(dd.data.x).toBe(100)
  expect(d.isDirty).toBe(true)
  expect(dd.isDirty).toBe(false)

  d.commit()
  expect(p.x).toBe(100)
  expect(d.data.x).toBe(100)
  expect(dd.data.x).toBe(100)
  expect(d.isDirty).toBe(false)
  expect(dd.isDirty).toBe(false)
})

test("drafts of drafts (2)", () => {
  d.data.setX(10)

  const dd = draft(d.data)
  dd.data.setX(100)

  expect(p.x).toBe(1)
  expect(d.data.x).toBe(10)
  expect(dd.data.x).toBe(100)
  expect(d.isDirty).toBe(true)
  expect(dd.isDirty).toBe(true)

  d.commit()
  expect(p.x).toBe(10)
  expect(d.data.x).toBe(10)
  expect(dd.data.x).toBe(100)
  expect(d.isDirty).toBe(false)
  expect(dd.isDirty).toBe(true)

  dd.commit()
  expect(p.x).toBe(10)
  expect(d.data.x).toBe(100)
  expect(dd.data.x).toBe(100)
  expect(d.isDirty).toBe(true)
  expect(dd.isDirty).toBe(false)
})
