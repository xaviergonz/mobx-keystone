import { computed, remove, set, toJS } from "mobx"
import {
  detach,
  findChildren,
  findParent,
  findParentPath,
  fromSnapshot,
  getChildrenObjects,
  getParent,
  getParentPath,
  getParentToChildPath,
  getRootPath,
  isChildOfParent,
  isParentOfChild,
  model,
  Model,
  modelSnapshotInWithMetadata,
  prop,
  runUnprotected,
} from "../../src"

const $errorMessage = "must be the model object instance instead of the '$' sub-object"

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
  const p = fromSnapshot(
    P,
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

  expect(() => isChildOfParent(p.$, p)).toThrow($errorMessage)
  expect(() => isParentOfChild(p, p.$)).toThrow($errorMessage)

  expect(() => isChildOfParent(p, p.$)).toThrow($errorMessage)
  expect(() => isParentOfChild(p.$, p)).toThrow($errorMessage)

  expect(isChildOfParent(p.p2!, p)).toBeTruthy()
  expect(isParentOfChild(p, p.p2!)).toBeTruthy()

  expect(isChildOfParent(p, p.p2!)).toBeFalsy()
  expect(isParentOfChild(p.p2!, p)).toBeFalsy()

  expect(findParent(p.p2!, (parent) => parent instanceof P)).toBe(p)
  expect(findParent(p.p2!, (parent) => parent instanceof P, 0)).toBe(p)
  expect(findParent(p.p2!, (parent) => parent instanceof P, 1)).toBe(p)
  expect(findParent(p.p2!, (parent) => parent instanceof P, 2)).toBe(p)
  expect(findParent(p.p2!, (parent) => parent instanceof P, 3)).toBe(p)

  expect(findParent(p.p2!, (parent) => parent instanceof P2)).toBe(undefined)

  expect(findParentPath(p.p2!, (parent) => parent instanceof P)).toEqual({
    parent: p,
    path: ["p2"],
  })
  expect(findParentPath(p.p2!, (parent) => parent instanceof P, 0)).toEqual({
    parent: p,
    path: ["p2"],
  })
  expect(findParentPath(p.p2!, (parent) => parent instanceof P, 1)).toEqual({
    parent: p,
    path: ["p2"],
  })
  expect(findParentPath(p.p2!, (parent) => parent instanceof P, 2)).toEqual({
    parent: p,
    path: ["p2"],
  })
  expect(findParentPath(p.p2!, (parent) => parent instanceof P, 3)).toEqual({
    parent: p,
    path: ["p2"],
  })

  expect(findParentPath(p.p2!, (parent) => parent instanceof P2)).toBe(undefined)

  expect(getParentPath(p)).toBeUndefined()
  expect(() => getParentPath(p.$)).toThrow($errorMessage)
  expect(() => getParentPath(p.x as any)).toThrow("must be a tree node") // not an object
  expect(getParentPath(p.arr)).toEqual({ parent: p, path: "arr" })
  expect(getParentPath(p.p2!)).toEqual({ parent: p, path: "p2" })
  expect(() => getParentPath(p.p2!.$)).toThrow($errorMessage)
  p.arr.forEach((p2, i) => {
    expect(getParentPath(p2)).toStrictEqual({ parent: p.arr, path: i })
  })

  expect(getRootPath(p.arr[0])).toEqual({
    root: p,
    path: ["arr", 0],
    pathObjects: [p, p.arr, p.arr[0]],
  })

  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr, p.p2])
  expect(() => Array.from(getChildrenObjects(p.$).values())).toThrow($errorMessage)
  expect(Array.from(getChildrenObjects(p.arr).values())).toEqual(toJS(p.arr))
  expect(Array.from(getChildrenObjects(p.p2!).values())).toEqual([])

  expect(Array.from(findChildren(p, () => true).values())).toEqual([p.arr, p.p2])
  expect(Array.from(findChildren(p, () => true, { deep: true }).values())).toEqual([
    p.arr,
    p.arr[0],
    p.arr[1],
    p.arr[2],
    p.p2,
  ])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([p.p2])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2], p.p2])

  expect(getParentToChildPath(p, p)).toEqual([])
  expect(getParentToChildPath(p, p.p2!)).toEqual(["p2"])
  expect(getParentToChildPath(p.p2!, p)).toEqual(undefined) // p is not a child of p.p2

  const p2 = p.p2!

  // delete prop (unsupported for this.x but supported for this.$ since they require proxies and would be slower)
  runUnprotected(() => {
    // this is valid in mobx5 but not mobx4
    // delete p.$.p2
    remove(p.$, "p2")
  })
  expect(p.p2).toBeUndefined()
  expect("p2" in p.$).toBeFalsy()
  expect(getParentPath(p2)).toBeUndefined()
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2]])

  // readd prop
  runUnprotected(() => {
    // this is valid in mobx5 but not mobx4
    // p.p2 = p2
    set(p.$, "p2", p2)
  })
  expect(getParentPath(p2)).toEqual({ parent: p, path: "p2" })
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr, p.p2])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([p.p2])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2], p.p2])

  // reassign prop
  runUnprotected(() => {
    p.p2 = undefined
  })
  expect(getParentPath(p2)).toBeUndefined()
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2]])

  // readd prop
  runUnprotected(() => {
    p.p2 = p2
  })
  expect(getParentPath(p2)).toEqual({ parent: p, path: "p2" })
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr, p.p2])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([p.p2])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2], p.p2])

  // detach
  runUnprotected(() => {
    detach(p2)
  })
  expect(getParentPath(p2)).toBeUndefined()
  expect(p.p2).toBeUndefined()
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2]])

  // readd prop
  runUnprotected(() => {
    // this is valid in mobx5 but not in mobx4
    // p.p2 = p2
    set(p.$, "p2", p2)
  })
  expect(getParentPath(p2)).toEqual({ parent: p, path: "p2" })
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr, p.p2])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([p.p2])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2], p.p2])

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
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2]])
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
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1]])

  runUnprotected(() => {
    p.arr[2] = p2arr[2]
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeDefined()
  expect(getParentPath(p2arr[2])).toBeDefined()
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1], p.arr[2]])

  // detach
  runUnprotected(() => {
    detach(p2arr[1])
  })
  expect(toJS(p.arr)).toEqual([p2arr[0], p2arr[2]])
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeUndefined()
  expect(getParentPath(p2arr[2])).toBeDefined()
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0], p.arr[1]])

  // set length
  runUnprotected(() => {
    p.arr.length = 1
  })
  expect(getParentPath(p2arr[0])).toBeDefined()
  expect(getParentPath(p2arr[1])).toBeUndefined()
  expect(getParentPath(p2arr[2])).toBeUndefined()
  expect(Array.from(getChildrenObjects(p).values())).toEqual([p.arr])
  expect(Array.from(findChildren(p, (node) => node instanceof P2).values())).toEqual([])
  expect(
    Array.from(findChildren(p, (node) => node instanceof P2, { deep: true }).values())
  ).toEqual([p.arr[0]])

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
      // this is valid in mobx5 but not in mobx4
      // ;(p.$ as any).z = p.arr[0]
      set(p.$, "z", p.arr[0])
    })
  }).toThrow("an object cannot be assigned a new parent when it already has one")
  expect((p.$ as any).z).toBe(undefined)
  expect("z" in p.$).toBeFalsy()
})

test("issue #446", () => {
  @model("Battle")
  class Battle extends Model({
    players: prop<Player[]>(() => []),
  }) {}

  @model("Player")
  class Player extends Model({
    fleet: prop<Fleet | undefined>(),
  }) {
    @computed
    get battle(): Battle {
      return getParent<Battle>(this)!
    }
  }

  @model("Fleet")
  class Fleet extends Model({
    ships: prop<Ship[]>(() => []),
  }) {
    @computed
    get player(): Player {
      return getParent<Player>(this)!
    }
  }

  @model("Ship")
  class Ship extends Model({}) {
    @computed
    get fleetGetParent(): Fleet {
      const ships = getParent<Ship[]>(this)
      return getParent<Fleet>(ships!)!
    }

    @computed
    get fleetFindParent(): Fleet {
      return findParent<Fleet>(this, (p) => p instanceof Fleet)!
    }
  }

  const battle = new Battle({
    players: [
      new Player({
        fleet: new Fleet({
          ships: [new Ship({})],
        }),
      }),
    ],
  })

  expect(battle.players[0].fleet!.player).toBeDefined()
  expect(battle.players[0].fleet!.ships[0].fleetGetParent.player).toBeDefined()
  expect(battle.players[0].fleet!.ships[0].fleetFindParent.player).toBeDefined()
})
