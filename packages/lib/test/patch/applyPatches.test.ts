import { toJS } from "mobx"
import { applyPatches, getSnapshot, runUnprotected } from "../../src"
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

  test.each([undefined, false, true])("replace (reverse=%j)", (reverse) => {
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
    expect(toJS(p.arr)).toEqual([1, 10, 2, 3])
  })

  test.each([undefined, false, true])("add (reverse=%j)", (reverse) => {
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
    expect(toJS(p.arr)).toEqual([1, reverse ? 10 : 11, reverse ? 11 : 10, 2, 3])
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
    expect(toJS(p.arr)).toEqual([1, 3])
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
    expect(toJS(p.arr)).toEqual([1, 10, 3])
  })

  test.each([undefined, false, true])("replace (reverse=%j)", (reverse) => {
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
    expect(toJS(p.arr)).toEqual([1, reverse ? 10 : 11, 3])
  })
})

describe("whole object", () => {
  test("add", () => {
    const newSn = { ...getSnapshot(p.p2), $modelId: "some other id" } // since we can't have two objects with the same type and id under the same tree
    runUnprotected(() => {
      applyPatches(p, [
        {
          op: "add",
          path: ["p3"],
          value: newSn,
        },
      ])
    })
    expect(getSnapshot((p.$ as any).p3)).toStrictEqual(newSn)
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

  test.each([undefined, false, true])("replace (same id, reverse=%j)", (reverse) => {
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
