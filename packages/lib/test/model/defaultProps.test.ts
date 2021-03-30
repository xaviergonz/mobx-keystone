import { assert, _ } from "spec.ts"
import {
  Model,
  model,
  ModelCreationData,
  ModelData,
  modelIdKey,
  prop,
  tProp,
  types,
} from "../../src"
import "../commonSetup"

@model("M")
class M extends Model({
  x: prop(42),
  xx: prop<number | undefined>(undefined),
  xxx: prop<number | null>(null),

  y: tProp(types.number, 42),
  yy: tProp(types.maybe(types.number), undefined),
  yyy: tProp(types.maybeNull(types.number), null),

  a: prop<number>(),
  aa: prop<number | undefined>(),
  aaa: prop<number | null>(),
  aaaa: prop<number | null | undefined>(),

  b: tProp(types.number),
  bb: tProp(types.maybe(types.number)),
  bbb: tProp(types.maybeNull(types.number)),
  bbbb: tProp(types.or(types.number, types.null, types.undefined)),
}) {}

test("default props", () => {
  assert(
    _ as ModelCreationData<M>,
    _ as {
      [modelIdKey]?: string

      x?: number | null
      xx?: number | null
      xxx?: number | null

      y?: number | null
      yy?: number | null
      yyy?: number | null

      a: number
      aa?: number
      aaa: number | null
      aaaa?: number | null

      b: number
      bb?: number
      bbb: number | null
      bbbb?: number | null
    }
  )

  assert(
    _ as ModelData<M>,
    _ as {
      [modelIdKey]: string

      x: number
      xx: number | undefined
      xxx: number | null

      y: number
      yy: number | undefined
      yyy: number | null

      a: number
      aa: number | undefined
      aaa: number | null
      aaaa: number | null | undefined

      b: number
      bb: number | undefined
      bbb: number | null
      bbbb: number | null | undefined
    }
  )

  const m0 = new M({ a: 7, aaa: 7, b: 7, bbb: 7 })

  expect(m0.x).toBe(42)
  expect(m0.xx).toBe(undefined)
  expect(m0.xxx).toBe(null)

  expect(m0.y).toBe(42)
  expect(m0.yy).toBe(undefined)
  expect(m0.yyy).toBe(null)

  expect(m0.a).toBe(7)
  expect(m0.aa).toBe(undefined)
  expect(m0.aaa).toBe(7)
  expect(m0.aaaa).toBe(undefined)

  expect(m0.b).toBe(7)
  expect(m0.bb).toBe(undefined)
  expect(m0.bbb).toBe(7)
  expect(m0.bbbb).toBe(undefined)

  const m1 = new M({
    x: 6,
    y: 6,
    xx: 6,
    xxx: 6,
    yy: 6,
    yyy: 6,
    a: 7,
    aa: 7,
    aaa: 7,
    aaaa: 7,
    b: 7,
    bb: 7,
    bbb: 7,
    bbbb: 7,
  })

  expect(m1.x).toBe(6)
  expect(m1.xx).toBe(6)
  expect(m1.xxx).toBe(6)

  expect(m1.y).toBe(6)
  expect(m1.yy).toBe(6)
  expect(m1.yyy).toBe(6)

  expect(m1.a).toBe(7)
  expect(m1.aa).toBe(7)
  expect(m1.aaa).toBe(7)
  expect(m1.aaaa).toBe(7)

  expect(m1.b).toBe(7)
  expect(m1.bb).toBe(7)
  expect(m1.bbb).toBe(7)
  expect(m1.bbbb).toBe(7)

  const m2 = new M({
    x: null,
    y: null,
    xx: null,
    xxx: null,
    yy: null,
    yyy: null,
    a: 7,
    aa: 7,
    aaa: null,
    aaaa: null,
    b: 7,
    bb: 7,
    bbb: null,
    bbbb: null,
  })

  expect(m2.x).toBe(42)
  expect(m2.xx).toBe(undefined)
  expect(m2.xxx).toBe(null)

  expect(m2.y).toBe(42)
  expect(m2.yy).toBe(undefined)
  expect(m2.yyy).toBe(null)

  expect(m2.a).toBe(7)
  expect(m2.aa).toBe(7)
  expect(m2.aaa).toBe(null)
  expect(m2.aaaa).toBe(null)

  expect(m2.b).toBe(7)
  expect(m2.bb).toBe(7)
  expect(m2.bbb).toBe(null)
  expect(m2.bbbb).toBe(null)

  const m3 = new M({
    x: undefined,
    y: undefined,
    xx: undefined,
    xxx: undefined,
    yy: undefined,
    yyy: undefined,
    a: 7,
    aa: undefined,
    aaa: 7,
    aaaa: undefined,
    b: 7,
    bb: undefined,
    bbb: 7,
    bbbb: undefined,
  })

  expect(m3.x).toBe(42)
  expect(m3.xx).toBe(undefined)
  expect(m3.xxx).toBe(null)

  expect(m3.y).toBe(42)
  expect(m3.yy).toBe(undefined)
  expect(m3.yyy).toBe(null)

  expect(m3.a).toBe(7)
  expect(m3.aa).toBe(undefined)
  expect(m3.aaa).toBe(7)
  expect(m3.aaaa).toBe(undefined)

  expect(m3.b).toBe(7)
  expect(m3.bb).toBe(undefined)
  expect(m3.bbb).toBe(7)
  expect(m3.bbbb).toBe(undefined)
})
