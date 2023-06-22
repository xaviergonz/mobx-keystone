import { reaction, toJS } from "mobx"
import {
  Model,
  applySnapshot,
  getRootStore,
  getSnapshot,
  idProp,
  isRootStore,
  modelAction,
  prop,
  registerRootStore,
  runUnprotected,
  tProp,
  toTreeNode,
  types,
  unregisterRootStore,
} from "../../src"
import { testModel } from "../utils"

const events: string[] = []

@testModel("P3")
export class P3 extends Model({
  z: prop(() => 20),
}) {
  onAttachedToRootStore(rootStore: P) {
    expect(isRootStore(rootStore)).toBeTruthy()
    events.push("p3Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      events.push("p3Detached")
    }
  }
}

@testModel("P2")
export class P2 extends Model({
  y: prop(() => 10),
  p3: prop(() => new P3({})),
}) {
  onAttachedToRootStore(rootStore: P) {
    expect(isRootStore(rootStore)).toBeTruthy()
    expect(getRootStore(this.p3)).toBe(rootStore)
    events.push("p2Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      expect(getRootStore(this.p3)).toBeUndefined()
      events.push("p2Detached")
    }
  }
}

@testModel("P")
export class P extends Model({
  x: prop(() => 5),
  arr: prop<P2[]>(() => []),
  p2: prop<P2 | undefined>(),
}) {
  onAttachedToRootStore(rootStore: P) {
    expect(isRootStore(rootStore)).toBeTruthy()
    if (this.p2) {
      expect(getRootStore(this.p2)).toBe(rootStore)
    }
    this.arr.forEach((p2) => {
      expect(getRootStore(p2)).toBe(rootStore)
    })
    events.push("p1Attached")

    return () => {
      // root store should be gone by now
      expect(getRootStore(this)).toBeUndefined()
      if (this.p2) {
        expect(getRootStore(this.p2)).toBeUndefined()
      }
      this.arr.forEach((p2) => {
        expect(getRootStore(p2)).toBeUndefined()
      })
      events.push("p1Detached")
    }
  }
}

export function createP() {
  return new P({
    p2: new P2({
      y: 12,
    }),
  })
}

function resetEvents() {
  events.length = 0
}

beforeEach(() => {
  resetEvents()
})

test("model as rootStore", () => {
  const p = createP()
  expect(getRootStore(p)).toBeUndefined()
  expect(isRootStore(p)).toBeFalsy()

  expect(events).toStrictEqual([])

  // register p as root store
  expect(registerRootStore(p)).toBe(p)

  expect(isRootStore(p)).toBeTruthy()
  expect(isRootStore(p.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(p.p2!)).toBe(p)
  expect(events).toMatchInlineSnapshot(`
    [
      "p1Attached",
      "p2Attached",
      "p3Attached",
    ]
  `)

  // detach p2 from root store
  resetEvents()
  const oldP2 = p.p2!
  runUnprotected(() => {
    p.p2 = undefined
  })

  expect(isRootStore(p)).toBeTruthy()
  expect(() => isRootStore(p.p2!)).toThrow("node must be a tree node")
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(oldP2)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
    [
      "p3Detached",
      "p2Detached",
    ]
  `)

  // reattach
  resetEvents()
  runUnprotected(() => {
    p.p2 = oldP2
  })

  expect(isRootStore(p)).toBeTruthy()
  expect(isRootStore(p.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBe(p)
  expect(getRootStore(p.p2!)).toBe(p)
  expect(events).toMatchInlineSnapshot(`
    [
      "p2Attached",
      "p3Attached",
    ]
  `)

  // unregister root store
  resetEvents()
  unregisterRootStore(p)
  expect(isRootStore(p)).toBeFalsy()
  expect(isRootStore(p.p2!)).toBeFalsy()
  expect(getRootStore(p)).toBeUndefined()
  expect(getRootStore(p.p2!)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
    [
      "p3Detached",
      "p2Detached",
      "p1Detached",
    ]
  `)
})

test("array as rootStore", () => {
  const arr = toTreeNode<P3[]>([new P3({})])
  expect(getRootStore(arr)).toBeUndefined()
  expect(isRootStore(arr)).toBeFalsy()

  expect(events).toStrictEqual([])

  // register arr as root store
  expect(registerRootStore(arr)).toBe(arr)

  expect(isRootStore(arr)).toBeTruthy()
  expect(isRootStore(arr[0]!)).toBeFalsy()
  expect(getRootStore(arr)).toBe(arr)
  expect(getRootStore(arr[0]!)).toBe(arr)
  expect(events).toMatchInlineSnapshot(`
    [
      "p3Attached",
    ]
  `)

  // detach p3 from root store
  resetEvents()
  const oldP3 = arr[0]!
  runUnprotected(() => {
    arr.splice(0, 1)
  })

  expect(isRootStore(arr)).toBeTruthy()
  expect(arr.length).toBe(0)
  expect(getRootStore(arr)).toBe(arr)
  expect(getRootStore(oldP3)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
    [
      "p3Detached",
    ]
  `)

  // reattach
  resetEvents()
  runUnprotected(() => {
    arr.push(oldP3)
  })

  expect(isRootStore(arr)).toBeTruthy()
  expect(isRootStore(arr[0]!)).toBeFalsy()
  expect(getRootStore(arr)).toBe(arr)
  expect(getRootStore(arr[0]!)).toBe(arr)
  expect(events).toMatchInlineSnapshot(`
    [
      "p3Attached",
    ]
  `)

  // unregister root store
  resetEvents()
  unregisterRootStore(arr)
  expect(isRootStore(arr)).toBeFalsy()
  expect(isRootStore(arr[0]!)).toBeFalsy()
  expect(getRootStore(arr)).toBeUndefined()
  expect(getRootStore(arr[0]!)).toBeUndefined()
  expect(events).toMatchInlineSnapshot(`
    [
      "p3Detached",
    ]
  `)
})

test("issue #27", () => {
  @testModel("#27/ModelWithArrayProp")
  class ModelWithArrayProp extends Model({
    values: prop<number[]>(),
  }) {
    onAttachedToRootStore(): void {
      this.setValues([1, 2, 3])
    }

    @modelAction
    public setValues(values: number[]): void {
      this.values = values
    }
  }

  const m = registerRootStore(new ModelWithArrayProp({ values: [] }))
  expect(toJS(m.values)).toEqual([1, 2, 3])
})

test("isRootStore is reactive", () => {
  @testModel("isRootStore is reactive/M")
  class M extends Model({}) {}
  const obj = new M({})
  const events: boolean[] = []

  reaction(
    () => isRootStore(obj),
    (isRS) => {
      events.push(isRS)
    },
    { fireImmediately: true }
  )

  expect(events).toEqual([false])
  events.length = 0

  registerRootStore(obj)
  expect(events).toEqual([true])
  events.length = 0

  unregisterRootStore(obj)
  expect(events).toEqual([false])
  events.length = 0
})

test("issue #316", () => {
  let mountCount = 0
  let unmountCount = 0

  @testModel("316/track")
  class Track extends Model({
    nodes: prop<TrackNode[]>(),
  }) {}

  @testModel("316/node")
  class TrackNode extends Model({
    name: prop<string>(),
  }) {
    counter: number = 0
    onAttachedToRootStore() {
      mountCount++
      return () => {
        unmountCount++
      }
    }
  }

  @testModel("316/app")
  class App extends Model({
    tracks: prop<Track[]>(),
  }) {
    @modelAction
    moveNode() {
      const track = new Track({ nodes: [] })
      this.tracks.push(track)
      // second onAttachedToRootStore
      // but we got three output
      track.nodes.push(
        new TrackNode({
          name: "node2",
        })
      )
    }
  }

  const track1 = new Track({ nodes: [] })
  const app = new App({ tracks: [track1] })
  registerRootStore(app)

  expect(mountCount).toBe(0)
  expect(unmountCount).toBe(0)

  app.moveNode()
  expect(unmountCount).toBe(0)
  expect(mountCount).toBe(1)

  unregisterRootStore(app)
  expect(mountCount).toBe(1)
  expect(unmountCount).toBe(1)
})

test("bug #384", () => {
  let calls = 0

  @testModel("bug #384/Todo")
  class Todo extends Model({
    text: prop<string>(),
  }) {
    onAttachedToRootStore() {
      calls++
    }
  }

  @testModel("bug #384/TodoStore")
  class Store extends Model({
    todos: prop<Todo[]>(() => []),
  }) {
    @modelAction
    setTodos(todos: Todo[]) {
      this.todos = todos
    }
  }

  const todos: Todo[] = []

  for (let i = 0; i < 5000; i++) {
    todos.push(new Todo({ text: "Todo #" + i }))
  }

  const store = new Store({})

  registerRootStore(store)
  store.setTodos(todos)

  expect(calls).toBe(todos.length)
})

test("issue #521, changing id", () => {
  const events: string[] = []

  @testModel("A")
  class A extends Model({
    id: idProp.withSetter(),
    n: tProp(types.number).withSetter(),
  }) {
    protected onAttachedToRootStore() {
      events.push("attach")
      return () => {
        events.push("detach")
      }
    }
  }

  @testModel("B")
  class B extends Model({
    id: idProp,
    a: tProp(types.model(A)),
  }) {}

  const b = new B({ id: "b", a: new A({ id: "a", n: 1 }) })
  expect(events).toMatchInlineSnapshot(`[]`)
  events.length = 0

  registerRootStore(b)
  expect(events).toMatchInlineSnapshot(`
    [
      "attach",
    ]
  `)
  events.length = 0

  const snapshot = getSnapshot(b)

  b.a.setId("2")
  expect(events).toMatchInlineSnapshot(`[]`)
  events.length = 0

  applySnapshot(b, snapshot)
  expect(events).toMatchInlineSnapshot(`
    [
      "detach",
      "attach",
    ]
  `)
  events.length = 0

  unregisterRootStore(b)
  expect(events).toMatchInlineSnapshot(`
    [
      "detach",
    ]
  `)
  events.length = 0
})

test("issue #521, changing a field other than id", () => {
  const events: string[] = []

  @testModel("A")
  class A extends Model({
    id: idProp.withSetter(),
    n: tProp(types.number).withSetter(),
  }) {
    protected onAttachedToRootStore() {
      events.push("attach")
      return () => {
        events.push("detach")
      }
    }
  }

  @testModel("B")
  class B extends Model({
    id: idProp,
    a: tProp(types.model(A)),
  }) {}

  const b = new B({ id: "b", a: new A({ id: "a", n: 1 }) })
  expect(events).toMatchInlineSnapshot(`[]`)
  events.length = 0

  registerRootStore(b)
  expect(events).toMatchInlineSnapshot(`
    [
      "attach",
    ]
  `)
  events.length = 0

  const snapshot = getSnapshot(b)

  b.a.setN(2)
  expect(events).toMatchInlineSnapshot(`[]`)
  events.length = 0

  debugger

  applySnapshot(b, snapshot)
  expect(events).toMatchInlineSnapshot(`[]`)
  events.length = 0

  unregisterRootStore(b)
  expect(events).toMatchInlineSnapshot(`
    [
      "detach",
    ]
  `)
  events.length = 0
})
