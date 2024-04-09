import {
  BaseModel,
  getParentToChildPath,
  Model,
  modelAction,
  onChildAttachedTo,
  Path,
  prop,
} from "../../src"
import { isArray, isObject } from "../../src/utils"
import { testModel } from "../utils"

const name = (obj: object) => {
  if (obj instanceof BaseModel) return obj.$modelType
  else if (isArray(obj)) return "Array"
  else if (isObject(obj)) return "Object"
  else return "unknown"
}

const events: string[] = []

const log = (type: "attached" | "detached", self: object, child: object, path: Path) => {
  events.push(
    `${type} ${type === "attached" ? "to" : "from"} ${name(self)} <- ${name(child)} at [${path.join(
      "/"
    )}]`
  )
}

beforeEach(() => {
  events.length = 0
})
;[true, false].forEach((deep) => {
  test(`onChildAttachedTo (deep: ${deep})`, () => {
    const disposers: ((runDetach: boolean) => void)[] = []

    const addHook = (node: object) => {
      const d = onChildAttachedTo(
        () => node,
        (child) => {
          const path = getParentToChildPath(node, child)
          if (!path) {
            fail("path between node and child could not be found")
          }
          log("attached", node, child, path)
          return () => {
            log("detached", node, child, path)
          }
        },
        {
          fireForCurrentChildren: true,
          deep: deep,
        }
      )
      disposers.push(d)
    }

    @testModel(`R-deep:${deep}`)
    class R extends Model({
      a: prop<A>(() => new A({})),
    }) {
      onInit() {
        addHook(this)
      }

      @modelAction
      setA(a: A) {
        this.a = a
      }
    }

    @testModel(`A-deep:${deep}`)
    class A extends Model({
      b: prop<B>(() => new B({})),
    }) {
      onInit() {
        addHook(this)
      }

      @modelAction
      setB(b: B) {
        this.b = b
      }
    }

    @testModel(`B-deep:${deep}`)
    class B extends Model({
      primitive: prop<string>("hi"),
      arr: prop<number[]>(() => [1, 2, 3]),
    }) {
      onInit() {
        addHook(this)
      }

      @modelAction
      setArr(arr: number[]) {
        this.arr = arr
      }
    }

    expect(events).toHaveLength(0)

    // initial children should be attached
    const r = new R({})
    expect(events).toMatchSnapshot("initial")

    // setting a new A
    events.length = 0
    r.setA(new A({}))
    expect(events).toMatchSnapshot("new A")

    // setting a new B
    events.length = 0
    r.a.setB(new B({}))
    expect(events).toMatchSnapshot("new B")

    // setting a new arr
    events.length = 0
    r.a.b.setArr([4, 5, 6])
    expect(events).toMatchSnapshot("new arr")

    // disposer
    disposers.forEach((d) => {
      d(false)
    })
    events.length = 0
    r.a.b.setArr([4, 5, 6])
    expect(events).toHaveLength(0)
  })
})

test("dynamic target", () => {
  const disposers: ((runDetach: boolean) => void)[] = []

  const addHook = (fn: () => object) => {
    const d = onChildAttachedTo(
      fn,
      (child) => {
        const node = fn()
        const path = getParentToChildPath(node, child)!
        log("attached", node, child, path)
        return () => {
          log("detached", node, child, path)
        }
      },
      {
        fireForCurrentChildren: true,
        deep: false,
      }
    )
    disposers.push(d)
  }

  @testModel(`TodoList`)
  class TodoList extends Model({
    todos: prop<Todo[]>(() => []),
  }) {
    onInit() {
      addHook(() => this.todos)
    }

    @modelAction
    addTodo(todo: Todo) {
      this.todos = [...this.todos, todo]
    }

    @modelAction
    removeTodo(todo: Todo) {
      this.todos = this.todos.filter((t) => t !== todo)
    }
  }

  @testModel(`Todo`)
  class Todo extends Model({}) {}

  expect(events).toHaveLength(0)

  // initial children should be attached
  const todoList = new TodoList({
    todos: [new Todo({}), new Todo({})],
  })
  expect(events).toMatchSnapshot("initial")

  // add a new todo
  events.length = 0
  todoList.addTodo(new Todo({}))
  expect(events).toMatchSnapshot("add Todo")

  // remove todo
  events.length = 0
  todoList.removeTodo(todoList.todos[1])
  expect(events).toMatchSnapshot("remove Todo")

  // disposer
  disposers.forEach((d) => {
    d(false)
  })
  events.length = 0
  todoList.removeTodo(todoList.todos[0])
  expect(events).toHaveLength(0)
})
