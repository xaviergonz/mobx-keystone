import { autorun, observable, reaction } from "mobx"
import { getSnapshot, runUnprotected } from "../../src"
import "../commonSetup"
import { createP } from "../testbed"
import { autoDispose } from "../utils"

test("basic types", () => {
  expect(getSnapshot(undefined)).toBe(undefined)
  expect(getSnapshot(null)).toBe(null)
  expect(getSnapshot(7)).toBe(7)
  expect(getSnapshot("str")).toBe("str")

  const obj = { a: 5 }
  expect(() => getSnapshot(observable(obj))).toThrow("getSnapshot") // not part of a tree

  const arr = [1, 2, 3]
  expect(() => getSnapshot(observable(arr))).toThrow("getSnapshot") // not part of a tree
})

test("model class", () => {
  const p = createP()
  runUnprotected(() => {
    p.data.x = 8
  })

  // initial state
  expect(getSnapshot(p)).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-2",
        "type": "P",
      },
      "arr": Array [],
      "p2": Object {
        "$$metadata": Object {
          "id": "mockedUuid-1",
          "type": "P2",
        },
        "y": 12,
      },
      "x": 8,
    }
  `)

  // detach submodel
  const oldP2 = p.data.p2!
  runUnprotected(() => {
    p.data.p2 = undefined
  })

  expect(getSnapshot(p)).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-2",
        "type": "P",
      },
      "arr": Array [],
      "p2": undefined,
      "x": 8,
    }
  `)

  expect(getSnapshot(oldP2)).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-1",
        "type": "P2",
      },
      "y": 12,
    }
  `)

  // mutate and reattach submodel
  runUnprotected(() => {
    oldP2.data.y++
    p.data.p2 = oldP2
  })

  expect(getSnapshot(p)).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-2",
        "type": "P",
      },
      "arr": Array [],
      "p2": Object {
        "$$metadata": Object {
          "id": "mockedUuid-1",
          "type": "P2",
        },
        "y": 13,
      },
      "x": 8,
    }
  `)
})

test("when unobserved they should not be generated each time", () => {
  const p = createP()
  const sna = getSnapshot(p)
  const snb = getSnapshot(p)

  expect(sna).toBe(snb)

  expect(sna.p2).toBe(snb.p2)
  expect(sna.arr).toBe(snb.arr)
})

test("when observed they should be the same", () => {
  const p = createP()
  autorun(() => {
    const sna = getSnapshot(p)
    const snb = getSnapshot(p)
    expect(sna).toBe(snb)
    expect(sna.p2).toBe(snb.p2)
    expect(sna.arr).toBe(snb.arr)

    runUnprotected(() => {
      p.data.p2!.data.y++
    })

    const snc = getSnapshot(p)
    expect(snc).not.toBe(sna)
    expect(snc).not.toStrictEqual(sna)
    expect(sna.p2).not.toBe(snc.p2)
    expect(sna.arr).toBe(snc.arr) // unchanged should be the same
  })()
})

test("reactive snapshots", () => {
  const p = createP()

  const pResult: any[] = []
  autoDispose(
    reaction(
      () => getSnapshot(p),
      newSn => {
        pResult.push(newSn)
      }
    )
  )

  const p2Result: any[] = []
  autoDispose(
    reaction(
      () => getSnapshot(p.data.p2),
      newSn => {
        p2Result.push(newSn)
      }
    )
  )

  expect(pResult.length).toBe(0)
  expect(p2Result.length).toBe(0)

  runUnprotected(() => {
    p.data.x++
  })
  expect(pResult.length).toBe(1)
  expect(p2Result.length).toBe(0)

  runUnprotected(() => {
    p.data.x++
  })
  expect(pResult.length).toBe(2)
  expect(p2Result.length).toBe(0)

  // changing children should also change the parent snapshot
  runUnprotected(() => {
    p.data.p2!.data.y++
  })
  expect(pResult.length).toBe(3)
  expect(p2Result.length).toBe(1)

  // no op
  runUnprotected(() => {
    p.data.x = p.data.x
    p.data.p2!.data.y = p.data.p2!.data.y
  })
  expect(pResult.length).toBe(3)
  expect(p2Result.length).toBe(1)
})
