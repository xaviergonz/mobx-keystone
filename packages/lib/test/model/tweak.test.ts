import { isObservable, keys, set, values } from "mobx"
import { getParent, isTreeNode, model, Model, prop, runUnprotected } from "../../src"

interface TestObj {
  x: number
}

function isTreeNodeAndObs(n: any) {
  const ok = isTreeNode(n) && isObservable(n)
  values(n)
  keys(n)
  return ok
}

test("initial data must be tweaked", () => {
  @model("A")
  class A extends Model({
    map: prop<{ obj1: TestObj; obj2: TestObj }>(() => ({
      obj1: { x: 10 },
      obj2: { x: 20 },
    })),
    arr: prop<TestObj[]>(() => [
      {
        x: 10,
      },
      {
        x: 20,
      },
    ]),
  }) {}

  expect(A.name).toBe("A")

  const a = new A({})

  expect(isTreeNodeAndObs(a.map)).toBeTruthy()
  expect(isTreeNodeAndObs(a.map.obj1)).toBeTruthy()
  expect(isTreeNodeAndObs(a.map.obj2)).toBeTruthy()
  expect(isTreeNodeAndObs(a.arr)).toBeTruthy()
  expect(isTreeNodeAndObs(a.arr[0])).toBeTruthy()
  expect(isTreeNodeAndObs(a.arr[1])).toBeTruthy()

  expect(getParent(a.map)).toBe(a)
  expect(getParent(a.map.obj1)).toBe(a.map)
  expect(getParent(a.map.obj2)).toBe(a.map)
  expect(getParent(a.arr)).toBe(a)
  expect(getParent(a.arr[0])).toBe(a.arr)
  expect(getParent(a.arr[1])).toBe(a.arr)
})

test("data added after intial data must be tweaked", () => {
  @model("B")
  class A extends Model({
    map: prop<{ obj1?: TestObj; obj2?: TestObj } | undefined>(),
    arr: prop<TestObj[] | undefined>(),
  }) {}

  {
    const a = new A({})
    runUnprotected(() => {
      a.arr = []
      expect(a.$.arr).toBeDefined()
      expect(a.arr).toBe(a.$.arr)
      expect(isObservable(a.arr)).toBe(true)
      a.arr.push({ x: 10 })
      a.arr.push({ x: 20 })

      a.map = {}
      expect(a.$.map).toBeDefined()
      expect(a.map).toBe(a.$.map)
      expect(isObservable(a.map)).toBe(true)

      // this is valid in mobx5 but not mobx4
      // a.map.obj1 = { x: 10 }
      // a.map.obj2 = { x: 20 }
      set(a.map, "obj1", { x: 10 })
      set(a.map, "obj2", { x: 20 })
    })

    expect(isTreeNodeAndObs(a.map!)).toBeTruthy()
    expect(isTreeNodeAndObs(a.map!.obj1!)).toBeTruthy()
    expect(isTreeNodeAndObs(a.map!.obj2!)).toBeTruthy()
    expect(isTreeNodeAndObs(a.arr!)).toBeTruthy()
    expect(isTreeNodeAndObs(a.arr![0])).toBeTruthy()
    expect(isTreeNodeAndObs(a.arr![1])).toBeTruthy()

    expect(getParent(a.map!)).toBe(a)
    expect(getParent(a.map!.obj1!)).toBe(a.map)
    expect(getParent(a.map!.obj2!)).toBe(a.map)
    expect(getParent(a.arr!)).toBe(a)
    expect(getParent(a.arr![0])).toBe(a.arr)
    expect(getParent(a.arr![1])).toBe(a.arr)
  }

  {
    const a = new A({})
    runUnprotected(() => {
      a.map = { obj1: { x: 10 }, obj2: { x: 20 } }
      a.arr = [{ x: 10 }, { x: 20 }]
    })

    expect(isTreeNodeAndObs(a.map!)).toBeTruthy()
    expect(isTreeNodeAndObs(a.map!.obj1!)).toBeTruthy()
    expect(isTreeNodeAndObs(a.map!.obj2!)).toBeTruthy()
    expect(isTreeNodeAndObs(a.arr!)).toBeTruthy()
    expect(isTreeNodeAndObs(a.arr![0])).toBeTruthy()
    expect(isTreeNodeAndObs(a.arr![1])).toBeTruthy()

    expect(getParent(a.map!)).toBe(a)
    expect(getParent(a.map!.obj1!)).toBe(a.map)
    expect(getParent(a.map!.obj2!)).toBe(a.map)
    expect(getParent(a.arr!)).toBe(a)
    expect(getParent(a.arr![0])).toBe(a.arr)
    expect(getParent(a.arr![1])).toBe(a.arr)
  }
})
