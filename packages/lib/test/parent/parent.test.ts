import {
  detach,
  findParent,
  fromSnapshot,
  getChildrenObjects,
  getParentPath,
  getRootPath,
  isChildOfParent,
  isParentOfChild,
  model,
  Model,
  modelSnapshotInWithMetadata,
  runUnprotected,
} from "../../src"
import "../commonSetup"

@model("P2")
export class P2 extends Model<{ y: number }> {
  defaultData = {
    y: 10,
  }
}

@model("P")
export class P extends Model<{ x: number; arr: P2[]; p2?: P2 }> {
  defaultData = {
    x: 5,
    arr: [],
  }
}

test("parent", () => {
  const p = fromSnapshot<P>(
    modelSnapshotInWithMetadata(
      P,
      {
        arr: [
          modelSnapshotInWithMetadata(P2, { y: 1 }, "P2-id1"),
          modelSnapshotInWithMetadata(P2, { y: 2 }, "P2-id2"),
          modelSnapshotInWithMetadata(P2, { y: 3 }, "P2-id3"),
        ],
        p2: modelSnapshotInWithMetadata(P2, { y: 12 }, "P2-idout"),
      },
      "P-id"
    )
  )

  expect(p instanceof P).toBeTruthy()

  expect(isChildOfParent(p, p)).toBeFalsy()
  expect(isParentOfChild(p, p)).toBeFalsy()

  expect(isChildOfParent(p.data, p)).toBeTruthy()
  expect(isParentOfChild(p, p.data)).toBeTruthy()

  expect(isChildOfParent(p, p.data)).toBeFalsy()
  expect(isParentOfChild(p.data, p)).toBeFalsy()

  expect(isChildOfParent(p.data.p2!, p)).toBeTruthy()
  expect(isParentOfChild(p, p.data.p2!)).toBeTruthy()

  expect(isChildOfParent(p, p.data.p2!)).toBeFalsy()
  expect(isParentOfChild(p.data.p2!, p)).toBeFalsy()

  expect(findParent(p.data.p2!, parent => parent instanceof P)).toBe(p)
  expect(findParent(p.data.p2!, parent => parent instanceof P2)).toBe(undefined)

  expect(getParentPath(p)).toBeUndefined()
  expect(getParentPath(p.data)).toEqual({ parent: p, path: "data" })
  expect(() => getParentPath(p.data.x as any)).toThrow("must be a tree node") // not an object
  expect(getParentPath(p.data.arr)).toEqual({ parent: p.data, path: "arr" })
  expect(getParentPath(p.data.p2!)).toEqual({ parent: p.data, path: "p2" })
  expect(getParentPath(p.data.p2!.data)).toEqual({ parent: p.data.p2, path: "data" })
  p.data.arr.forEach((p2, i) => {
    expect(getParentPath(p2)).toStrictEqual({ parent: p.data.arr, path: i })
  })

  expect(getRootPath(p.data.arr[0].data)).toEqual({
    root: p,
    path: ["data", "arr", 0, "data"],
  })

  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.data])
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr, p.data.p2])
  expect(Array.from(getChildrenObjects(p.data.arr).values())).toEqual(p.data.arr)
  expect(Array.from(getChildrenObjects(p.data.p2!).values())).toEqual([p.data.p2!.data])

  const p2 = p.data.p2!

  // delete prop
  runUnprotected(() => {
    delete p.data.p2
  })
  expect(p.data.p2).toBeUndefined()
  expect("p2" in p.data).toBeFalsy()
  expect(getParentPath(p2)).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])

  // readd prop
  runUnprotected(() => {
    p.data.p2 = p2
  })
  expect(getParentPath(p2)).toEqual({ parent: p.data, path: "p2" })
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr, p.data.p2])

  // reassign prop
  runUnprotected(() => {
    p.data.p2 = undefined
  })
  expect(getParentPath(p2)).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])

  // readd prop
  runUnprotected(() => {
    p.data.p2 = p2
  })
  expect(getParentPath(p2)).toEqual({ parent: p.data, path: "p2" })
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr, p.data.p2])

  // detach
  runUnprotected(() => {
    detach(p2)
  })
  expect(getParentPath(p2)).toBeUndefined()
  expect(p.data.p2).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])

  const p2arr = [p.data.arr[0], p.data.arr[1], p.data.arr[2]]

  // pop
  const popped = runUnprotected(() => {
    return p.data.arr.pop()!
  })
  expect(p.data.arr.length).toBe(2)
  expect(popped).toBe(p2arr[2])
  expect(getParentPath(popped)).toBeUndefined()

  // push back
  runUnprotected(() => {
    p.data.arr.push(popped)
  })
  expect(p.data.arr.length).toBe(3)
  expect(getParentPath(popped)).toBeDefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])

  // delete array prop
  // TODO: support this? mobx array interceptor/update is not emitted
  /*
  runUnprotected(() => {
    delete p.data.arr[2]
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeDefined()
  expect(getParentPath(p2arr[2])).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])
  */

  // assign index
  runUnprotected(() => {
    p.data.arr[2] = null as any
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeDefined()
  expect(getParentPath(p2arr[2])).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])

  runUnprotected(() => {
    p.data.arr[2] = p2arr[2]
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeDefined()
  expect(getParentPath(p2arr[2])).toBeDefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])

  // detach
  runUnprotected(() => {
    detach(p2arr[1])
  })
  expect(p.data.arr).toEqual([p2arr[0], p2arr[2]])
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeUndefined()
  expect(getParentPath(p2arr[2])).toBeDefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])

  // set length
  runUnprotected(() => {
    p.data.arr.length = 1
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeUndefined()
  expect(getParentPath(p2arr[2])).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.data).values())).toEqual([p.data.arr])

  // adding to the array something that is already attached should fail
  const oldArrayLength = p.data.arr.length
  expect(() => {
    runUnprotected(() => {
      p.data.arr.push(p.data.arr[0])
    })
  }).toThrow("an object cannot be assigned a new parent when it already has one")
  expect(p.data.arr.length).toBe(oldArrayLength)

  expect(() => {
    runUnprotected(() => {
      ;(p.data as any).z = p.data.arr[0]
    })
  }).toThrow("an object cannot be assigned a new parent when it already has one")
  expect((p.data as any).z).toBe(undefined)
  expect("z" in p.data).toBeFalsy()
})
