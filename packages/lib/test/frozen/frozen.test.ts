import {
  fromSnapshot,
  frozen,
  Frozen,
  getParent,
  getRoot,
  getSnapshot,
  model,
  Model,
  prop,
  runUnprotected,
  types,
} from "../../src"
import { frozenKey } from "../../src/frozen/Frozen"
import { emulateProdMode } from "../utils"

@model("MWithFrozenProp")
class MWithFrozenProp extends Model({
  frozenStuff: prop<Frozen<any> | undefined>(),
}) {}

@model("MWithNumber")
class MWithNumber extends Model({
  n: prop<number>(),
}) {}

function basicTest<T>(name: string, data: T) {
  test(name, () => {
    const frType = types.frozen(types.unchecked<T>())
    const fr = frozen(data)

    expect(fr instanceof Frozen).toBe(true)
    expect(fr.data).toBe(data)

    const sn = getSnapshot(fr)
    expect(sn[frozenKey]).toBe(true)
    expect(sn.data).toStrictEqual(data)

    const frBack = fromSnapshot(frType, sn)
    expect(frBack instanceof Frozen).toBe(true)
    expect(frBack).not.toBe(fr)
    expect(frBack.data).toBe(sn.data)

    const p = new MWithFrozenProp({ frozenStuff: fr })

    expect(getSnapshot(p).frozenStuff).toBe(sn)
    expect(getParent(fr)).toBe(p)
    expect(getRoot(fr)).toBe(p)

    runUnprotected(() => {
      p.frozenStuff = undefined
    })

    expect(getSnapshot(p).frozenStuff).toBe(undefined)
    expect(getParent(fr)).toBe(undefined)
    expect(getRoot(fr)).toBe(fr)
  })
}

basicTest("primitive", 5)
basicTest("array", [1, 2, 3])
basicTest("plain object", { a: 1, b: 2, c: 3 })
basicTest("plain complex object", { a: { aa: 1 }, b: 2, c: 3 })

test("a non plain object should throw in dev mode, but not in prod mode", () => {
  expect(() => frozen(function () {})).toThrow("frozen data must be plainly serializable to JSON")
  emulateProdMode(() => {
    expect(() => frozen(function () {})).not.toThrow()
  })
})

test("data is frozen in dev mode, but not in prod mode", () => {
  expect(() => {
    const fr = frozen([1, 2, 3])
    ;(fr.data as any)[0] = 10
  }).toThrow()

  emulateProdMode(() => {
    const fr = frozen([1, 2, 3])
    expect(() => {
      ;(fr.data as any)[0] = 10
    }).not.toThrow()
  })
})

test("it is possible to store a snapshot in a frozen", () => {
  const p2 = new MWithNumber({
    n: 12,
  })

  const p2Sn = getSnapshot(p2)

  const p = new MWithFrozenProp({
    frozenStuff: frozen(p2Sn),
  })

  const pFromSn = fromSnapshot<MWithFrozenProp>(getSnapshot(p))

  expect(pFromSn.frozenStuff instanceof MWithNumber).toBe(false)
  expect(pFromSn.frozenStuff?.data).toBeTruthy()
  expect(pFromSn.frozenStuff?.data.n).toBe(12)

  const p2FromSn = fromSnapshot<MWithNumber>(pFromSn.frozenStuff?.data)
  expect(p2FromSn instanceof MWithNumber).toBe(true)
  expect(p2FromSn.n).toBe(12)
})
