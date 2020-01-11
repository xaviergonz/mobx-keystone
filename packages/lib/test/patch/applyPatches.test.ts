import { applyPatches, getSnapshot, runUnprotected } from "../../src"
import "../commonSetup"
import { createP } from "../testbed"

let p = createP(true)
beforeEach(() => {
  p = createP(true)
})

describe("object property", () => {
  let p2data: any
  beforeEach(() => {
    p2data = p.p2!.$
  })

  test("add", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "add",
          path: ["p2", "z"],
          value: 10,
        },
      ])
    })
    expect(p2data.z).toBe(10)
  })

  test("remove", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "remove",
          path: ["p2", "y"],
        },
      ])
    })
    expect(p2data.y).toBeUndefined()
  })

  test("replace", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "replace",
          path: ["p2", "y"],
          value: 10,
        },
      ])
    })
    expect(p2data.y).toBe(10)
  })

  test.each([undefined, false, true])("replace (reverse=%j)", reverse => {
    runUnprotected(() => {
      applyPatches(
        p,
        [
          {
            op: "replace",
            path: ["p2", "y"],
            value: 10,
          },
          {
            op: "replace",
            path: ["p2", "y"],
            value: 11,
          },
        ],
        reverse
      )
    })
    expect(p2data.y).toBe(reverse ? 10 : 11)
  })
})

describe("array", () => {
  test("add", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "add",
          path: ["arr", "1"],
          value: 10,
        },
      ])
    })
    expect(p.arr).toEqual([1, 10, 2, 3])
  })

  test.each([undefined, false, true])("add (reverse=%j)", reverse => {
    runUnprotected(() => {
      applyPatches(
        p,
        [
          {
            op: "add",
            path: ["arr", "1"],
            value: 10,
          },
          {
            op: "add",
            path: ["arr", "1"],
            value: 11,
          },
        ],
        reverse
      )
    })
    expect(p.arr).toEqual([1, reverse ? 10 : 11, !reverse ? 10 : 11, 2, 3])
  })

  test("remove", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "remove",
          path: ["arr", "1"],
        },
      ])
    })
    expect(p.arr).toEqual([1, 3])
  })

  test("replace", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "replace",
          path: ["arr", "1"],
          value: 10,
        },
      ])
    })
    expect(p.arr).toEqual([1, 10, 3])
  })

  test.each([undefined, false, true])("replace (reverse=%j)", reverse => {
    runUnprotected(() => {
      applyPatches(
        p,
        [
          {
            op: "replace",
            path: ["arr", "1"],
            value: 10,
          },
          {
            op: "replace",
            path: ["arr", "1"],
            value: 11,
          },
        ],
        reverse
      )
    })
    expect(p.arr).toEqual([1, reverse ? 10 : 11, 3])
  })
})

describe("whole object", () => {
  test("add", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "add",
          path: ["p3"],
          value: getSnapshot(p.p2),
        },
      ])
    })
    expect((p.$ as any).p3).toStrictEqual(p.p2!)
  })

  test("remove", () => {
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "remove",
          path: ["p2"],
        },
      ])
    })
    expect(p.p2).toBeUndefined()
  })

  test("replace (same id)", () => {
    const oldP2 = p.p2!
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "replace",
          path: ["p2"],
          value: { ...getSnapshot(oldP2), y: 20 },
        },
      ])
    })
    expect(p.p2).toBe(oldP2)
    expect(p.p2!.y).toBe(20)
  })

  test.each([undefined, false, true])("replace (same id, reverse=%j)", reverse => {
    const oldP2 = p.p2!
    runUnprotected(() => {
      applyPatches(
        p,
        [
          {
            op: "replace",
            path: ["p2"],
            value: { ...getSnapshot(oldP2), y: 20 },
          },
          {
            op: "replace",
            path: ["p2"],
            value: { ...getSnapshot(oldP2), y: 21 },
          },
        ],
        reverse
      )
    })
    expect(p.p2).toBe(oldP2)
    expect(p.p2!.y).toBe(reverse ? 20 : 21)
  })
})
