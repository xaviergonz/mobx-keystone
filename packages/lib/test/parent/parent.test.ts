import {
  detach,
  findParent,
  fromSnapshot,
  getChildrenObjects,
  getParent,
  getParentPath,
  getRootPath,
  isChildOfParent,
  isParentOfChild,
  model,
  Model,
  modelSnapshotInWithMetadata,
  prop,
  runUnprotected,
} from "../../src"
import "../commonSetup"

@model("P2")
export class P2 extends Model({
  y: prop(() => 10),
}) {}

@model("P")
export class P extends Model({
  x: prop(() => 5),
  arr: prop<P2[]>(() => []),
  p2: prop<P2 | undefined>(),
}) {}

test("parent", () => {
  const p = fromSnapshot<P>(
    modelSnapshotInWithMetadata(P, {
      arr: [
        modelSnapshotInWithMetadata(P2, { y: 1 }),
        modelSnapshotInWithMetadata(P2, { y: 2 }),
        modelSnapshotInWithMetadata(P2, { y: 3 }),
      ],
      p2: modelSnapshotInWithMetadata(P2, { y: 12 }),
    })
  )

  expect(p instanceof P).toBeTruthy()

  expect(isChildOfParent(p, p)).toBeFalsy()
  expect(isParentOfChild(p, p)).toBeFalsy()

  expect(isChildOfParent(p.$, p)).toBeTruthy()
  expect(isParentOfChild(p, p.$)).toBeTruthy()

  expect(isChildOfParent(p, p.$)).toBeFalsy()
  expect(isParentOfChild(p.$, p)).toBeFalsy()

  expect(isChildOfParent(p.p2!, p)).toBeTruthy()
  expect(isParentOfChild(p, p.p2!)).toBeTruthy()

  expect(isChildOfParent(p, p.p2!)).toBeFalsy()
  expect(isParentOfChild(p.p2!, p)).toBeFalsy()

  expect(findParent(p.p2!, parent => parent instanceof P)).toBe(p)
  expect(findParent(p.p2!, parent => parent instanceof P, 0)).toBe(p)
  expect(findParent(p.p2!, parent => parent instanceof P, 1)).toBe(undefined) // since p2 is actually in p.$.p2
  expect(findParent(p.p2!, parent => parent instanceof P, 2)).toBe(p)
  expect(findParent(p.p2!, parent => parent instanceof P, 3)).toBe(p)

  expect(findParent(p.p2!, parent => parent instanceof P2)).toBe(undefined)

  expect(getParentPath(p)).toBeUndefined()
  expect(getParentPath(p.$)).toEqual({ parent: p, path: "$" })
  expect(() => getParentPath(p.x as any)).toThrow("must be a tree node") // not an object
  expect(getParentPath(p.arr)).toEqual({ parent: p.$, path: "arr" })
  expect(getParentPath(p.p2!)).toEqual({ parent: p.$, path: "p2" })
  expect(getParentPath(p.p2!.$)).toEqual({
    parent: p.p2,
    path: "$",
  })
  p.arr.forEach((p2, i) => {
    expect(getParentPath(p2)).toStrictEqual({ parent: p.arr, path: i })
  })

  expect(getParent(p.$, false)).toBe(p)
  expect(getParent(p.$, true)).toBe(p)
  expect(getParent(p.arr, false)).toBe(p.$)
  expect(getParent(p.arr, true)).toBe(p)

  expect(getRootPath(p.arr[0].$)).toEqual({
    root: p,
    path: ["$", "arr", 0, "$"],
  })

  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.$])
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr, p.p2])
  expect(Array.from(getChildrenObjects(p.arr).values())).toEqual(p.arr)
  expect(Array.from(getChildrenObjects(p.p2!).values())).toEqual([p.p2!.$])

  const p2 = p.p2!

  // delete prop (unsupported for this.x but supported for this.$ since they require proxies and would be slower)
  runUnprotected(() => {
    delete p.$.p2
  })
  expect(p.p2).toBeUndefined()
  expect("p2" in p.$).toBeFalsy()
  expect(getParentPath(p2)).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr])

  // readd prop
  runUnprotected(() => {
    p.p2 = p2
  })
  expect(getParentPath(p2)).toEqual({ parent: p.$, path: "p2" })
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr, p.p2])

  // reassign prop
  runUnprotected(() => {
    p.p2 = undefined
  })
  expect(getParentPath(p2)).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr])

  // readd prop
  runUnprotected(() => {
    p.p2 = p2
  })
  expect(getParentPath(p2)).toEqual({ parent: p.$, path: "p2" })
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr, p.p2])

  // detach
  runUnprotected(() => {
    detach(p2)
  })
  expect(getParentPath(p2)).toBeUndefined()
  expect(p.p2).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr])

  // readd prop
  runUnprotected(() => {
    p.p2 = p2
  })
  expect(getParentPath(p2)).toEqual({ parent: p.$, path: "p2" })
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr, p.p2])

  // detach once more
  runUnprotected(() => {
    detach(p2)
  })

  const p2arr = [p.arr[0], p.arr[1], p.arr[2]]

  // pop
  const popped = runUnprotected(() => {
    return p.arr.pop()!
  })
  expect(p.arr.length).toBe(2)
  expect(popped).toBe(p2arr[2])
  expect(getParentPath(popped)).toBeUndefined()
  for (let i = 0; i < p.arr.length; i++) {
    expect(getParentPath(p.arr[i])!.path).toBe(i)
  }

  // push back
  runUnprotected(() => {
    p.arr.push(popped)
  })
  expect(p.arr.length).toBe(3)
  expect(getParentPath(popped)).toBeDefined()
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr])
  for (let i = 0; i < p.arr.length; i++) {
    expect(getParentPath(p.arr[i])!.path).toBe(i)
  }

  // splice
  const spliced = runUnprotected(() => {
    return p.arr.splice(1, 1)
  })[0]
  expect(p.arr.length).toBe(2)
  expect(spliced).toBe(p2arr[1])
  expect(getParentPath(spliced)).toBeUndefined()
  for (let i = 0; i < p.arr.length; i++) {
    expect(getParentPath(p.arr[i])!.path).toBe(i)
  }

  // splice back
  runUnprotected(() => {
    return p.arr.splice(1, 0, spliced)
  })
  expect(p.arr.length).toBe(3)
  expect(getParentPath(spliced)).toBeDefined()
  for (let i = 0; i < p.arr.length; i++) {
    expect(getParentPath(p.arr[i])!.path).toBe(i)
  }

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
    p.arr[2] = null as any
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeDefined()
  expect(getParentPath(p2arr[2])).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr])

  runUnprotected(() => {
    p.arr[2] = p2arr[2]
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeDefined()
  expect(getParentPath(p2arr[2])).toBeDefined()
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr])

  // detach
  runUnprotected(() => {
    detach(p2arr[1])
  })
  expect(p.arr).toEqual([p2arr[0], p2arr[2]])
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeUndefined()
  expect(getParentPath(p2arr[2])).toBeDefined()
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr])

  // set length
  runUnprotected(() => {
    p.arr.length = 1
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeUndefined()
  expect(getParentPath(p2arr[2])).toBeUndefined()
  expect(Array.from(getChildrenObjects(p.$).values())).toEqual([p.arr])

  // adding to the array something that is already attached should fail
  const oldArrayLength = p.arr.length
  expect(() => {
    runUnprotected(() => {
      p.arr.push(p.arr[0])
    })
  }).toThrow("an object cannot be assigned a new parent when it already has one")
  expect(p.arr.length).toBe(oldArrayLength)

  expect(() => {
    runUnprotected(() => {
      ;(p.$ as any).z = p.arr[0]
    })
  }).toThrow("an object cannot be assigned a new parent when it already has one")
  expect((p.$ as any).z).toBe(undefined)
  expect("z" in p.$).toBeFalsy()
})
