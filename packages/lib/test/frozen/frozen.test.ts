import {
  fromSnapshot,
  frozen,
  Frozen,
  getParent,
  getRoot,
  getSnapshot,
  model,
  Model,
  newModel,
  prop,
  runUnprotected,
} from "../../src"
import { frozenKey } from "../../src/frozen/Frozen"
import "../commonSetup"
import { emulateProdMode } from "../utils"

@model("P")
class P extends Model({
  frozenStuff: prop<Frozen<any> | undefined>(),
}) {}

describe("frozen", () => {
  function basicTest<T>(name: string, data: T) {
    test(name, () => {
      const fr = frozen(data)

      expect(fr instanceof Frozen).toBe(true)
      expect(fr.data).toBe(data)

      const sn = getSnapshot(fr)
      expect(sn[frozenKey]).toBe(true)
      expect(sn.data).toStrictEqual(data)

      const frBack = fromSnapshot<Frozen<T>>(sn)
      expect(frBack instanceof Frozen).toBe(true)
      expect(frBack).not.toBe(fr)
      expect(frBack.data).toBe(sn.data)

      const p = newModel(P, { frozenStuff: fr })

      expect(getSnapshot(p).frozenStuff).toBe(sn)
      expect(getParent(fr)).toBe(p.$)
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
    expect(() => frozen(function() {})).toThrow("frozen data must be plainly serializable to JSON")
    emulateProdMode(() => {
      expect(() => frozen(function() {})).not.toThrow()
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
})
