import {
  addActionMiddleware,
  applyAction,
  registerRootStore,
  standaloneAction,
  tag,
  toTreeNode,
  types,
  TypeToData,
} from "../../src"
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
      setDone(todo, !todo.done)
    },
  }))

  const setDone = standaloneAction("myApp/Todo1::setDone", (todo: Todo, done: boolean) => {
    todo.done = done
  })

  const setText = standaloneAction("myApp/Todo1::setText", (todo: Todo, text: string) => {
    todo.text = text
  })

  const setAll = standaloneAction(
    "myApp/Todo1::setAll",
    (todo: Todo, done: boolean, text: string) => {
      // just to see we can use actions within actions
      setDone(todo, done)

      todo.text = text
      return 32 + todoTag.for(todo).ten
    }
  )

  const todo = toTreeNode<Todo>({ done: true, text: "1" })
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

  setDone(todo, true)
  expect(todo.done).toBe(true)

  setText(todo, "2")
  expect(todo.text).toBe("2")

  expect(setAll(todo, false, "3")).toBe(42)
  expect(todo.done).toBe(false)
  expect(todo.text).toBe("3")

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo1::setDone",
          "args": Array [
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
            false,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "myApp/Todo1::setAll",
            "args": Array [
              Object {
                "done": false,
                "text": "3",
              },
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
              Object {
                "done": false,
                "text": "3",
              },
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
            Object {
              "done": false,
              "text": "3",
            },
            false,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "myApp/Todo1::setAll",
            "args": Array [
              Object {
                "done": false,
                "text": "3",
              },
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
              Object {
                "done": false,
                "text": "3",
              },
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
            Object {
              "done": false,
              "text": "3",
            },
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
  type Todo = TypeToData<typeof todoType>

  const setDone = standaloneAction("myApp/Todo2::setDone", (todo: Todo, done: boolean) => {
    todo.done = done
  })

  const setText = standaloneAction("myApp/Todo2::setText", (todo: Todo, text: string) => {
    todo.text = text
  })

  const setAll = standaloneAction(
    "myApp/Todo2::setAll",
    (todo: Todo, done: boolean, text: string) => {
      // just to see we can use actions within actions
      setDone(todo, done)

      todo.text = text
      return 42
    }
  )
  const todo = toTreeNode(todoType, { done: false, text: "1" })
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

  setDone(todo, true)
  expect(todo.done).toBe(true)

  setText(todo, "2")
  expect(todo.text).toBe("2")

  expect(setAll(todo, false, "3")).toBe(42)
  expect(todo.done).toBe(false)
  expect(todo.text).toBe("3")

  expect(events).toMatchInlineSnapshot(`
    Array [
      Object {
        "ctx": Object {
          "actionName": "myApp/Todo2::setDone",
          "args": Array [
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
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
            Object {
              "done": false,
              "text": "3",
            },
            false,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "myApp/Todo2::setAll",
            "args": Array [
              Object {
                "done": false,
                "text": "3",
              },
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
              Object {
                "done": false,
                "text": "3",
              },
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
            Object {
              "done": false,
              "text": "3",
            },
            false,
          ],
          "data": Object {},
          "parentContext": Object {
            "actionName": "myApp/Todo2::setAll",
            "args": Array [
              Object {
                "done": false,
                "text": "3",
              },
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
              Object {
                "done": false,
                "text": "3",
              },
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
            Object {
              "done": false,
              "text": "3",
            },
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
