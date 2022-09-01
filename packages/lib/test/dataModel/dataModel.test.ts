import { computed, reaction } from "mobx"
import { assert, _ } from "spec.ts"
import {
  addActionMiddleware,
  applyAction,
  DataModel,
  ExtendedDataModel,
  getParent,
  idProp,
  Model,
  modelAction,
  modelClass,
  ModelData,
  modelFlow,
  prop,
  registerRootStore,
  toTreeNode,
  tProp,
  types,
  _async,
  _await,
} from "../../src"
import { autoDispose, delay, testModel } from "../utils"

test("without type", async () => {
  let viewRuns = 0

  @testModel("myApp/Todo1")
  class Todo extends DataModel({
    done: prop<boolean>().withSetter(),
    text: prop<string>(),
  }) {
    ten = 10

    get inverseDone() {
      return !this.done
    }

    toggleDone() {
      this.setDone(!this.done)
    }

    @computed
    get asString() {
      viewRuns++
      return `${this.done ? "DONE" : "TODO"} ${this.text}`
    }

    @modelAction
    setText = (text: string) => {
      this.text = text
    }

    @modelAction
    setAll(done: boolean, text: string) {
      // just to see we can use views within actions
      const str = this.asString
      expect(str).toBe(`${this.done ? "DONE" : "TODO"} ${this.text}`)

      // just to see we can use actions within actions
      this.setDone(done)

      todo.text = text
      return 32 + this.ten
    }

    private *_asyncAction(done: boolean) {
      this.done = done
      yield* _await(delay(10))
      return this.done
    }

    @modelFlow
    asyncAction = _async(this._asyncAction)
  }

  assert(
    _ as ModelData<Todo>,
    _ as {
      done: boolean
      text: string
    }
  )

  const todo = new Todo({ done: true, text: "1" })
  registerRootStore(todo.$)

  // props
  expect(todo.done).toBe(todo.$.done)
  expect(todo.text).toBe(todo.$.text)

  expect(todo.ten).toBe(10)
  expect(todo.inverseDone).toBe(false)
  todo.toggleDone()
  expect(todo.done).toBe(false)

  // uncached when not observed
  expect(viewRuns).toBe(0)
  expect(todo.asString).toBe("TODO 1")
  expect(todo.asString).toBe("TODO 1")
  expect(viewRuns).toBe(2)
  viewRuns = 0

  // cached when observed
  autoDispose(
    reaction(
      () => todo.asString,
      () => {}
    )
  )
  expect(viewRuns).toBe(1)
  expect(todo.asString).toBe("TODO 1")
  expect(todo.asString).toBe("TODO 1")
  expect(viewRuns).toBe(1)
  viewRuns = 0

  const events: any = []

  autoDispose(
    addActionMiddleware({
      subtreeRoot: todo.$,
      middleware(ctx, next) {
        events.push({
          event: "action started",
          ctx,
        })
        const result = next()
        events.push({
          event: "action finished",
          ctx,
          result,
        })
        return result
      },
    })
  )
  expect(events.length).toBe(0)

  todo.setDone(true)
  expect(viewRuns).toBe(1)
  expect(todo.done).toBe(true)
  expect(todo.$.done).toBe(todo.done)

  todo.setText("2")
  expect(todo.text).toBe("2")
  expect(todo.$.text).toBe(todo.text)

  expect(todo.setAll(false, "3")).toBe(42)
  expect(todo.done).toBe(false)
  expect(todo.text).toBe("3")

  expect(events).toMatchInlineSnapshot(`
    [
      {
        "ctx": {
          "actionName": "fn::without type/myApp/Todo1::setDone",
          "args": [
            true,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::without type/myApp/Todo1::setDone",
          "args": [
            true,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      {
        "ctx": {
          "actionName": "fn::without type/myApp/Todo1::setText",
          "args": [
            "2",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::without type/myApp/Todo1::setText",
          "args": [
            "2",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      {
        "ctx": {
          "actionName": "fn::without type/myApp/Todo1::setAll",
          "args": [
            false,
            "3",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::without type/myApp/Todo1::setDone",
          "args": [
            false,
          ],
          "data": {},
          "parentContext": {
            "actionName": "fn::without type/myApp/Todo1::setAll",
            "args": [
              false,
              "3",
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "rootContext": {
            "actionName": "fn::without type/myApp/Todo1::setAll",
            "args": [
              false,
              "3",
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::without type/myApp/Todo1::setDone",
          "args": [
            false,
          ],
          "data": {},
          "parentContext": {
            "actionName": "fn::without type/myApp/Todo1::setAll",
            "args": [
              false,
              "3",
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "rootContext": {
            "actionName": "fn::without type/myApp/Todo1::setAll",
            "args": [
              false,
              "3",
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      {
        "ctx": {
          "actionName": "fn::without type/myApp/Todo1::setAll",
          "args": [
            false,
            "3",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": 42,
      },
    ]
  `)

  expect(
    applyAction(todo.$, {
      actionName: "fn::without type/myApp/Todo1::setAll",
      args: [true, "4"],
      targetPath: [],
      targetPathIds: [],
    })
  ).toBe(42)

  expect(todo.done).toBe(true)
  expect(todo.text).toBe("4")

  // flows
  const newDone = await todo.asyncAction(false)
  expect(todo.done).toBe(false)
  expect(newDone).toBe(false)
})

test("with type", async () => {
  let viewRuns = 0

  @testModel("myApp/Todo2")
  class Todo extends DataModel({
    done: tProp(types.boolean).withSetter(),
    text: tProp(types.string),
  }) {
    ten = 10

    get inverseDone() {
      return !this.done
    }

    toggleDone() {
      this.setDone(!this.done)
    }

    @computed
    get asString() {
      viewRuns++
      return `${this.done ? "DONE" : "TODO"} ${this.text}`
    }

    @modelAction
    setText = (text: string) => {
      this.text = text
    }

    @modelAction
    setAll(done: boolean, text: string) {
      // just to see we can use views within actions
      const str = this.asString
      expect(str).toBe(`${this.done ? "DONE" : "TODO"} ${this.text}`)

      // just to see we can use actions within actions
      this.setDone(done)

      todo.text = text
      return 32 + this.ten
    }

    private *_asyncAction(done: boolean) {
      this.done = done
      yield* _await(delay(10))
      return this.done
    }

    @modelFlow
    asyncAction = _async(this._asyncAction)
  }

  assert(
    _ as ModelData<Todo>,
    _ as {
      done: boolean
      text: string
    }
  )

  const todo = new Todo({ done: true, text: "1" })
  expect(todo.typeCheck()).toBe(null)
  registerRootStore(todo.$)

  // props
  expect(todo.done).toBe(todo.$.done)
  expect(todo.text).toBe(todo.$.text)

  expect(todo.ten).toBe(10)
  expect(todo.inverseDone).toBe(false)
  todo.toggleDone()
  expect(todo.done).toBe(false)

  // uncached when not observed
  expect(viewRuns).toBe(0)
  expect(todo.asString).toBe("TODO 1")
  expect(todo.asString).toBe("TODO 1")
  expect(viewRuns).toBe(2)
  viewRuns = 0

  // cached when observed
  autoDispose(
    reaction(
      () => todo.asString,
      () => {}
    )
  )
  expect(viewRuns).toBe(1)
  expect(todo.asString).toBe("TODO 1")
  expect(todo.asString).toBe("TODO 1")
  expect(viewRuns).toBe(1)
  viewRuns = 0

  const events: any = []

  autoDispose(
    addActionMiddleware({
      subtreeRoot: todo.$,
      middleware(ctx, next) {
        events.push({
          event: "action started",
          ctx,
        })
        const result = next()
        events.push({
          event: "action finished",
          ctx,
          result,
        })
        return result
      },
    })
  )
  expect(events.length).toBe(0)

  todo.setDone(true)
  expect(viewRuns).toBe(1)
  expect(todo.done).toBe(true)
  expect(todo.$.done).toBe(todo.done)

  todo.setText("2")
  expect(todo.text).toBe("2")
  expect(todo.$.text).toBe(todo.text)

  expect(todo.setAll(false, "3")).toBe(42)
  expect(todo.done).toBe(false)
  expect(todo.text).toBe("3")

  expect(events).toMatchInlineSnapshot(`
    [
      {
        "ctx": {
          "actionName": "fn::with type/myApp/Todo2::setDone",
          "args": [
            true,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::with type/myApp/Todo2::setDone",
          "args": [
            true,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      {
        "ctx": {
          "actionName": "fn::with type/myApp/Todo2::setText",
          "args": [
            "2",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::with type/myApp/Todo2::setText",
          "args": [
            "2",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      {
        "ctx": {
          "actionName": "fn::with type/myApp/Todo2::setAll",
          "args": [
            false,
            "3",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::with type/myApp/Todo2::setDone",
          "args": [
            false,
          ],
          "data": {},
          "parentContext": {
            "actionName": "fn::with type/myApp/Todo2::setAll",
            "args": [
              false,
              "3",
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "rootContext": {
            "actionName": "fn::with type/myApp/Todo2::setAll",
            "args": [
              false,
              "3",
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::with type/myApp/Todo2::setDone",
          "args": [
            false,
          ],
          "data": {},
          "parentContext": {
            "actionName": "fn::with type/myApp/Todo2::setAll",
            "args": [
              false,
              "3",
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "rootContext": {
            "actionName": "fn::with type/myApp/Todo2::setAll",
            "args": [
              false,
              "3",
            ],
            "data": {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      {
        "ctx": {
          "actionName": "fn::with type/myApp/Todo2::setAll",
          "args": [
            false,
            "3",
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": 42,
      },
    ]
  `)

  expect(
    applyAction(todo.$, {
      actionName: "fn::with type/myApp/Todo2::setAll",
      args: [true, "4"],
      targetPath: [],
      targetPathIds: [],
    })
  ).toBe(42)

  expect(todo.done).toBe(true)
  expect(todo.text).toBe("4")

  // flows
  const newDone = await todo.asyncAction(false)
  expect(todo.done).toBe(false)
  expect(newDone).toBe(false)
})

test("idProp is not allowed", () => {
  expect(() =>
    DataModel({
      id: idProp,
    })
  ).toThrow('expected no idProp but got some: ["id"]')
})

test("onLazyInit gets called", () => {
  let lazyInitCalls = 0

  @testModel("test/LazyInit")
  class LazyInit extends DataModel({
    x: prop<number>(),
  }) {
    onLazyInit() {
      lazyInitCalls++
      this.x++
    }
  }

  expect(lazyInitCalls).toBe(0)

  const inst = new LazyInit({ x: 10 })
  expect(lazyInitCalls).toBe(1)
  expect(inst.x).toBe(11)
})

test("multiple calls to new with the same tree node return the same instance", () => {
  @testModel("test/SameInstance")
  class SameInstance extends DataModel({
    x: prop<number>(),
  }) {}

  const inst1 = new SameInstance({ x: 10 })
  const inst2 = new SameInstance(inst1.$)
  expect(inst1).toBe(inst2)
})

test("type checking", () => {
  @testModel("test/TypeCheck")
  class TypeCheck extends DataModel({
    x: tProp(types.number),
  }) {}

  const wrongData = {
    x: "10",
  }

  const errorMsg = "TypeCheckError: [/x] Expected: number"

  expect(() => new TypeCheck(wrongData as any)).toThrow(errorMsg)
})

test("parent/child", () => {
  @testModel("test/ChildModel")
  class ChildModel extends DataModel({
    x: tProp(types.number),
  }) {}

  @testModel("test/ParentModel")
  class ParentModel extends Model({
    subObj: tProp(types.maybe(types.dataModelData(ChildModel))).withSetter(),
  }) {}

  const pm = new ParentModel({})

  const tc = new ChildModel({ x: 10 })

  expect(() => pm.setSubObj(tc)).toThrow(
    "data models are not directly supported. you may insert the data in the tree instead ('$' property)."
  )
  pm.setSubObj(tc.$)
  expect(pm.subObj).toBe(tc.$)
  expect(getParent(tc.$)).toBe(pm)
  expect(() => getParent(tc)).toThrow("value must be a tree node")
})

test("two different classes over the same data return different instances", () => {
  @testModel("test/a")
  class A extends DataModel({ x: prop<number>() }) {}

  @testModel("test/b")
  class B extends DataModel({ x: prop<number>() }) {}

  const data = toTreeNode({ x: 10 })

  expect(new A(data)).not.toBe(new B(data))
})

test("extends works", () => {
  @testModel("test/extends/base")
  class Base extends DataModel({ x: prop<number>().withSetter() }) {}

  const bm = new Base({ x: 10 })
  expect(bm.x).toBe(10)

  const events: any = []

  autoDispose(
    addActionMiddleware({
      subtreeRoot: bm.$,
      middleware(ctx, next) {
        events.push({
          event: "action started",
          ctx,
        })
        const result = next()
        events.push({
          event: "action finished",
          ctx,
          result,
        })
        return result
      },
    })
  )

  bm.setX(30)

  expect(bm.x).toBe(30)

  expect(events).toMatchInlineSnapshot(`
    [
      {
        "ctx": {
          "actionName": "fn::extends works/test/extends/base::setX",
          "args": [
            30,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "x": 30,
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::extends works/test/extends/base::setX",
          "args": [
            30,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "x": 30,
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
    ]
  `)

  @testModel("test/extends/extended")
  class Extended extends ExtendedDataModel(Base, {
    y: prop<number>().withSetter(),
  }) {}

  const m = new Extended({ x: 10, y: 20 })
  expect(m.x).toBe(10)
  expect(m.y).toBe(20)

  events.length = 0
  autoDispose(
    addActionMiddleware({
      subtreeRoot: m.$,
      middleware(ctx, next) {
        events.push({
          event: "action started",
          ctx,
        })
        const result = next()
        return result
      },
    })
  )

  m.setX(30)
  m.setY(40)

  expect(m.x).toBe(30)
  expect(m.y).toBe(40)

  expect(events).toMatchInlineSnapshot(`
    [
      {
        "ctx": {
          "actionName": "fn::extends works/test/extends/extended::setX",
          "args": [
            30,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "x": 30,
            "y": 40,
          },
          "type": "sync",
        },
        "event": "action started",
      },
      {
        "ctx": {
          "actionName": "fn::extends works/test/extends/extended::setY",
          "args": [
            40,
          ],
          "data": {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": {
            "x": 30,
            "y": 40,
          },
          "type": "sync",
        },
        "event": "action started",
      },
    ]
  `)
})

test("new pattern for generics", () => {
  @testModel("GenericModel")
  class GenericModel<T1, T2> extends DataModel(<U1, U2>() => ({
    v1: prop<U1>(),
    v2: prop<U2>(),
    v3: prop<number>(),
  }))<T1, T2> {}

  assert(_ as ModelData<GenericModel<string, number>>, _ as { v1: string; v2: number; v3: number })
  assert(_ as ModelData<GenericModel<number, string>>, _ as { v1: number; v2: string; v3: number })

  const s = new GenericModel<string, number>({ v1: "1", v2: 2, v3: 3 })
  expect(s.v1).toBe("1")
  expect(s.v2).toBe(2)
  expect(s.v3).toBe(3)

  @testModel("ExtendedGenericModel")
  class ExtendedGenericModel<T1, T2> extends ExtendedDataModel(<T1, T2>() => ({
    baseModel: modelClass<GenericModel<T1, T2>>(GenericModel),
    props: {
      v4: prop<T2>(),
    },
  }))<T1, T2> {}

  const e = new ExtendedGenericModel<string, number>({ v1: "1", v2: 2, v3: 3, v4: 4 })
  expect(e.v1).toBe("1")
  expect(e.v2).toBe(2)
  expect(e.v3).toBe(3)
  expect(e.v4).toBe(4)
})
