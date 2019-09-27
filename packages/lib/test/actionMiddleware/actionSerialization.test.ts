import { isObservable, observable } from "mobx"
import {
  ActionCall,
  ActionTrackingResult,
  applyAction,
  deserializeActionCall,
  deserializeActionCallArgument,
  getSnapshot,
  model,
  Model,
  modelAction,
  onActionMiddleware,
  prop,
  serializeActionCall,
  serializeActionCallArgument,
  SerializedDate,
  SerializedMap,
  SerializedPathRef,
  SerializedSet,
} from "../../src"
import "../commonSetup"

test("serializeActionCallArgument and deserializeActionCallArgument", () => {
  @model("SACM")
  class SACM extends Model({
    child: prop<SACM | undefined>(),
  }) {}

  const r1 = new SACM({
    child: new SACM({}),
  })

  // unserializable args
  class RandomClass {}
  const rc = new RandomClass()

  expect(() => serializeActionCallArgument(r1, rc)).toThrow(
    "serializeActionCallArgument could not serialize the given value"
  )

  // primitive
  expect(serializeActionCallArgument(r1, 42)).toBe(42)
  expect(deserializeActionCallArgument(r1, 42)).toBe(42)

  // date
  const serDate = { $mobxKeystoneSerialized: "dateAsTimestamp", timestamp: 1000 } as SerializedDate
  expect(serializeActionCallArgument(r1, new Date(1000))).toEqual(serDate)
  expect(deserializeActionCallArgument(r1, serDate)).toEqual(new Date(1000))

  // plain obj
  const obj = { x: 10 }

  expect(serializeActionCallArgument(r1, obj)).toEqual(obj)
  expect(deserializeActionCallArgument(r1, obj)).toEqual(obj)

  // observable obj
  const obsObj = observable(obj)

  expect(serializeActionCallArgument(r1, obsObj)).toEqual(obj)
  expect(isObservable(serializeActionCallArgument(r1, obsObj))).toBe(false)

  // array
  const arr = [{ x: 10 }, 20]

  expect(serializeActionCallArgument(r1, arr)).toEqual(arr)
  expect(deserializeActionCallArgument(r1, arr)).toEqual(arr)

  // observable array
  const obsArr = observable(arr)

  expect(serializeActionCallArgument(r1, obsArr)).toEqual(arr)
  expect(isObservable(serializeActionCallArgument(r1, obsArr))).toBe(false)
  expect(isObservable(serializeActionCallArgument(r1, obsArr)[0])).toBe(false)

  // map
  const mapKV: [any, any][] = [["x", 10], ["y", { z: 20 }]]
  const map = new Map<any, any>(mapKV)

  expect(serializeActionCallArgument(r1, map)).toEqual({
    $mobxKeystoneSerialized: "mapAsArray",
    items: mapKV,
  } as SerializedMap)
  const mapBack = deserializeActionCallArgument(r1, {
    $mobxKeystoneSerialized: "mapAsArray",
    items: mapKV,
  } as SerializedMap)
  expect(mapBack instanceof Map).toBe(true)
  expect(Array.from(mapBack.entries())).toEqual(mapKV)

  // set
  const setK: any[] = ["x", { z: 20 }]
  const set = new Set<any>(setK)

  expect(serializeActionCallArgument(r1, set)).toEqual({
    $mobxKeystoneSerialized: "setAsArray",
    items: setK,
  } as SerializedSet)
  const setBack = deserializeActionCallArgument(r1, {
    $mobxKeystoneSerialized: "setAsArray",
    items: setK,
  } as SerializedSet)
  expect(setBack instanceof Set).toBe(true)
  expect(Array.from(setBack.keys())).toEqual(setK)

  // model without shared root ref

  const r2 = new SACM({
    child: new SACM({}),
  })

  {
    expect(serializeActionCallArgument(r1, r2)).toBe(getSnapshot(r2))

    const serializedR2Child = serializeActionCallArgument(r1, r2.child)
    expect(serializedR2Child).toBe(getSnapshot(r2.child))

    const deserializedR2Child = deserializeActionCallArgument(r1, serializedR2Child)
    expect(deserializedR2Child instanceof SACM).toBe(true)
    expect(deserializedR2Child).not.toBe(r2.child)
    expect(getSnapshot(deserializedR2Child)).toEqual(getSnapshot(r2.child))
  }

  // child model with shared root ref
  {
    const serializedR2Child = serializeActionCallArgument(r2, r2.child)
    expect(serializedR2Child).toEqual({
      $mobxKeystoneSerialized: "pathRef",
      targetPath: ["child"],
      targetPathIds: [r2.child!.$modelId],
    } as SerializedPathRef)

    const deserializedR2Child = deserializeActionCallArgument(r2, serializedR2Child)
    expect(deserializedR2Child).toBe(r2.child)
  }

  // root model with shared root ref
  {
    const serializedR2Child = serializeActionCallArgument(r2, r2)
    expect(serializedR2Child).toEqual({
      $mobxKeystoneSerialized: "pathRef",
      targetPath: [],
      targetPathIds: [],
    } as SerializedPathRef)

    const deserializedR2Child = deserializeActionCallArgument(r2, serializedR2Child)
    expect(deserializedR2Child).toBe(r2)
  }
})

describe("concurrency", () => {
  @model("TodoList")
  class TodoList extends Model({
    list: prop<Todo[]>(() => []),
  }) {
    @modelAction
    add(todo: Todo) {
      this.list.push(todo)
    }

    @modelAction
    remove(todo: Todo) {
      const index = this.list.indexOf(todo)
      if (index >= 0) {
        this.list.splice(index, 1)
      }
      return index >= 0
    }

    @modelAction
    removeMany(todos: Todo[]) {
      todos.forEach(todo => {
        this.remove(todo)
      })
    }
  }

  @model("Todo")
  class Todo extends Model({
    text: prop<string>(),
    done: prop(false),
  }) {
    @modelAction
    setText(t: string) {
      this.text = t
    }

    @modelAction
    setDone(d: boolean) {
      this.done = d
    }
  }

  const newTodoList = () =>
    new TodoList({
      list: [new Todo({ text: "todo1" }), new Todo({ text: "todo2" }), new Todo({ text: "todo3" })],
    })

  let todoList!: TodoList
  let capturing = true
  let captured: ActionCall[] = []
  beforeEach(() => {
    todoList = newTodoList()
    capturing = true
    captured.length = 0

    onActionMiddleware(todoList, {
      onStart(actionCall) {
        if (capturing) {
          captured.push(serializeActionCall(todoList, actionCall))
          return {
            result: ActionTrackingResult.Return,
            value: undefined,
          }
        }
        return undefined
      },
    })
  })

  function replicate(actionCall: ActionCall) {
    capturing = false
    const ac = deserializeActionCall(todoList, actionCall)
    applyAction(todoList, ac)
  }

  test("remove and change text on same item", () => {
    // capture events
    todoList.remove(todoList.list[1])
    todoList.list[1].setText("hello")

    expect(captured.length).toBe(2)
    // remove
    replicate(captured[0])
    // trying to change a deleted item
    expect(() => replicate(captured[1])).toThrow(
      'object at path ["list",1] with ids [null,"id-6"] could not be resolved'
    )
  })

  test("remove same item twice", () => {
    // capture events
    todoList.remove(todoList.list[1])
    todoList.remove(todoList.list[1])

    expect(captured.length).toBe(2)
    // remove
    replicate(captured[0])
    // trying to remove already removed item
    expect(() => replicate(captured[1])).toThrow(
      'object at path ["list",1] with ids [null,"id-10"] could not be resolved'
    )
  })

  test("remove two and change text on third item", () => {
    // capture events
    todoList.removeMany([todoList.list[0], todoList.list[1]])
    todoList.list[2].setText("hello")

    expect(captured.length).toBe(2)
    // remove
    replicate(captured[0])
    // trying to change an item that moved to index 0 from index 2
    expect(() => replicate(captured[1])).toThrow(
      'object at path ["list",2] with ids [null,"id-15"] could not be resolved'
    )
  })

  test("remove 0,1 and 1,2", () => {
    // capture events
    todoList.removeMany([todoList.list[0], todoList.list[1]])
    todoList.removeMany([todoList.list[1], todoList.list[2]])

    expect(captured.length).toBe(2)
    // remove
    replicate(captured[0])
    // trying to remove an item that no longer exists
    expect(() => replicate(captured[1])).toThrow(
      'object at path ["list",1] with ids [null,"id-18"] could not be resolved'
    )
  })
})
