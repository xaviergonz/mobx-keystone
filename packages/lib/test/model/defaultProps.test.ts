import { assert, _ } from "spec.ts"
import { Model, model, prop, tProp, types } from "../../src"
import "../commonSetup"

@model("M")
class M extends Model({
  x: prop(42),
  xx: prop<number | undefined>(undefined),
  xxx: prop<number | null>(null),

  y: tProp(types.number, 42),
  yy: tProp(types.maybe(types.number), undefined),
  yyy: tProp(types.maybeNull(types.number), null),
}) {}

test("default props", () => {
  const m0 = new M({})
  const m1 = new M({ x: 6, y: 6, xx: 6, xxx: 6, yy: 6, yyy: 6 })
  const m2 = new M({ x: null, y: null, xx: null, xxx: null, yy: null, yyy: null })
  const m3 = new M({
    x: undefined,
    y: undefined,
    xx: undefined,
    xxx: undefined,
    yy: undefined,
    yyy: undefined,
  })

  assert(m0.x, _ as number)
  assert(m0.xx, _ as number | undefined)
  assert(m0.xxx, _ as number | null)

  expect(m0.x).toBe(42)
  expect(m1.x).toBe(6)
  expect(m2.x).toBe(42)
  expect(m3.x).toBe(42)

  expect(m0.xx).toBe(undefined)
  expect(m1.xx).toBe(6)
  expect(m2.xx).toBe(undefined)
  expect(m3.xx).toBe(undefined)

  expect(m0.xxx).toBe(null)
  expect(m1.xxx).toBe(6)
  expect(m2.xxx).toBe(null)
  expect(m3.xxx).toBe(null)

  assert(m0.y, _ as number)
  assert(m0.yy, _ as number | undefined)
  assert(m0.yyy, _ as number | null)

  expect(m0.y).toBe(42)
  expect(m1.y).toBe(6)
  expect(m2.y).toBe(42)
  expect(m3.y).toBe(42)

  expect(m0.yy).toBe(undefined)
  expect(m1.yy).toBe(6)
  expect(m2.yy).toBe(undefined)
  expect(m3.yy).toBe(undefined)

  expect(m0.yyy).toBe(null)
  expect(m1.yyy).toBe(6)
  expect(m2.yyy).toBe(null)
  expect(m3.yyy).toBe(null)
})
