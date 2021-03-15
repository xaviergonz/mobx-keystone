import { assert, _ } from "spec.ts"
import {
  addActionMiddleware,
  applyAction,
  registerRootStore,
  tag,
  types,
  TypeToData,
} from "../../src"
import { fnModel, FnModelData } from "../../src/standardActions/fnModel"
import "../commonSetup"
import { autoDispose } from "../utils"

test("without type", async () => {
  interface Todo {
    done: boolean
    text: string
  }

  const todoTag = tag((todo: Todo) => ({
    ten: 10,
    get inverseDone() {
      return !todo.done
    },
    toggleDone() {
      todoModel.setDone(todo, !todo.done)
    },
  }))

  const todoModel = fnModel<Todo>("myApp/Todo1").actions({
    setDone(done: boolean) {
      this.done = done
    },
    setText(text: string) {
      this.text = text
    },
    setAll(done: boolean, text: string) {
      // just to see we can use actions within actions
      todoModel.setDone(this, done)

      todo.text = text
      return 32 + todoTag.for(this).ten
    },
  })

  assert(_ as FnModelData<typeof todoModel>, _ as Todo)

  expect(todoModel.type).toBe(null)

  const todo = todoModel.create({ done: true, text: "1" })
  registerRootStore(todo)

  // tag
  const myTodoTag = todoTag.for(todo)
  // same once constructed
  expect(todoTag.for(todo)).toBe(myTodoTag)

  expect(myTodoTag.ten).toBe(10)
  expect(myTodoTag.inverseDone).toBe(false)
  myTodoTag.toggleDone()
  expect(todo.done).toBe(false)

  const events: any = []

  autoDispose(
    addActionMiddleware({
      subtreeRoot: todo,
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

  todoModel.setDone(todo, true)
  expect(todo.done).toBe(true)

  todoModel.setText(todo, "2")
  expect(todo.text).toBe("2")

  expect(todoModel.setAll(todo, false, "3")).toBe(42)
  expect(todo.done).toBe(false)
  expect(todo.text).toBe("3")

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setDone",
          "args": Array [
            true,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setDone",
          "args": Array [
            true,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setText",
          "args": Array [
            "2",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setText",
          "args": Array [
            "2",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setAll",
          "args": Array [
            false,
            "3",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setDone",
          "args": Array [
            false,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "myApp/Todo1::setAll",
            "args": Array [
              false,
              "3",
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": Object {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "rootContext": Object {
            "actionName": "myApp/Todo1::setAll",
            "args": Array [
              false,
              "3",
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": Object {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setDone",
          "args": Array [
            false,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "myApp/Todo1::setAll",
            "args": Array [
              false,
              "3",
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": Object {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "rootContext": Object {
            "actionName": "myApp/Todo1::setAll",
            "args": Array [
              false,
              "3",
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": Object {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setAll",
          "args": Array [
            false,
            "3",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
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
    applyAction(todo, {
      actionName: "myApp/Todo1::setAll",
      args: [todo, true, "4"],
      targetPath: [],
      targetPathIds: [],
    })
  ).toBe(42)

  expect(todo.done).toBe(true)
  expect(todo.text).toBe("4")
})

test("with type", async () => {
  const todoType = types.object(() => ({
    done: types.boolean,
    text: types.string,
  }))

  const todoModel = fnModel(todoType, "myApp/Todo2").actions({
    setDone(done: boolean) {
      this.done = done
    },
    setText(text: string) {
      this.text = text
    },
    setAll(done: boolean, text: string) {
      // just to see we can use actions within actions
      todoModel.setDone(this, done)

      todo.text = text
      return 42
    },
  })

  assert(_ as FnModelData<typeof todoModel>, _ as TypeToData<typeof todoType>)

  expect(todoModel.type).toBe(todoType)

  const todo = todoModel.create({ done: false, text: "1" })
  registerRootStore(todo)

  const events: any = []

  autoDispose(
    addActionMiddleware({
      subtreeRoot: todo,
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

  todoModel.setDone(todo, true)
  expect(todo.done).toBe(true)

  todoModel.setText(todo, "2")
  expect(todo.text).toBe("2")

  expect(todoModel.setAll(todo, false, "3")).toBe(42)
  expect(todo.done).toBe(false)
  expect(todo.text).toBe("3")

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setDone",
          "args": Array [
            true,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setDone",
          "args": Array [
            true,
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setText",
          "args": Array [
            "2",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setText",
          "args": Array [
            "2",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setAll",
          "args": Array [
            false,
            "3",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setDone",
          "args": Array [
            false,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "myApp/Todo2::setAll",
            "args": Array [
              false,
              "3",
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": Object {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "rootContext": Object {
            "actionName": "myApp/Todo2::setAll",
            "args": Array [
              false,
              "3",
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": Object {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action started",
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setDone",
          "args": Array [
            false,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "myApp/Todo2::setAll",
            "args": Array [
              false,
              "3",
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": Object {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "rootContext": Object {
            "actionName": "myApp/Todo2::setAll",
            "args": Array [
              false,
              "3",
            ],
            "data": Object {},
            "parentContext": undefined,
            "rootContext": [Circular],
            "target": Object {
              "done": false,
              "text": "3",
            },
            "type": "sync",
          },
          "target": Object {
            "done": false,
            "text": "3",
          },
          "type": "sync",
        },
        "event": "action finished",
        "result": undefined,
      },
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setAll",
          "args": Array [
            false,
            "3",
          ],
          "data": Object {},
          "parentContext": undefined,
          "rootContext": [Circular],
          "target": Object {
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
    applyAction(todo, {
      actionName: "myApp/Todo2::setAll",
      args: [todo, true, "4"],
      targetPath: [],
      targetPathIds: [],
    })
  ).toBe(42)

  expect(todo.done).toBe(true)
  expect(todo.text).toBe("4")
})
