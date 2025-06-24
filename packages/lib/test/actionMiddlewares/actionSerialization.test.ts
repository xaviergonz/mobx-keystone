import { isObservable, observable } from "mobx"
import {
  ActionTrackingResult,
  applyAction,
  deserializeActionCall,
  deserializeActionCallArgument,
  getSnapshot,
  idProp,
  Model,
  modelAction,
  modelIdKey,
  namespace,
  onActionMiddleware,
  prop,
  serializeActionCall,
  serializeActionCallArgument,
  SerializedActionCall,
  SerializedActionCallArgument,
} from "../../src"
import { testModel } from "../utils"

test("serializeActionCallArgument and deserializeActionCallArgument", () => {
  // unserializable args
  class RandomClass {}
  const rc = new RandomClass()

  expect(() => serializeActionCallArgument(rc)).toThrow(
    "serializeActionCallArgument could not serialize the given value"
  )

  // primitives

  // number
  const serNumber = 42
  expect(serializeActionCallArgument(42)).toEqual(serNumber)
  expect(deserializeActionCallArgument(serNumber)).toBe(42)

  // number (NaN)
  const serNumberNaN = { $mobxKeystoneSerializer: `${namespace}/primitiveAsString`, value: "nan" }
  expect(serializeActionCallArgument(Number.NaN)).toEqual(serNumberNaN)
  expect(deserializeActionCallArgument(serNumberNaN)).toBeNaN()

  // number (+Infinity)
  const serNumberPosInf = {
    $mobxKeystoneSerializer: `${namespace}/primitiveAsString`,
    value: "+inf",
  }
  expect(serializeActionCallArgument(Number.POSITIVE_INFINITY)).toEqual(serNumberPosInf)
  expect(deserializeActionCallArgument(serNumberPosInf)).toBe(Number.POSITIVE_INFINITY)

  // number (-Infinity)
  const serNumberNegInf = {
    $mobxKeystoneSerializer: `${namespace}/primitiveAsString`,
    value: "-inf",
  }
  expect(serializeActionCallArgument(Number.NEGATIVE_INFINITY)).toEqual(serNumberNegInf)
  expect(deserializeActionCallArgument(serNumberNegInf)).toBe(Number.NEGATIVE_INFINITY)

  // bigint
  const serBigInt = { $mobxKeystoneSerializer: `${namespace}/primitiveAsString`, value: "42" }
  expect(serializeActionCallArgument(42n)).toEqual(serBigInt)
  expect(deserializeActionCallArgument(serBigInt)).toBe(42n)

  // undefined
  const serUndefined = {
    $mobxKeystoneSerializer: `${namespace}/primitiveAsString`,
    value: "undefined",
  }
  expect(serializeActionCallArgument(undefined)).toEqual(serUndefined)
  expect(deserializeActionCallArgument(serUndefined)).toBeUndefined()

  // string
  const serString = "ho"
  expect(serializeActionCallArgument("ho")).toEqual(serString)
  expect(deserializeActionCallArgument(serString)).toBe("ho")

  // boolean
  const serBoolean = true
  expect(serializeActionCallArgument(true)).toEqual(serBoolean)
  expect(deserializeActionCallArgument(serBoolean)).toBe(true)

  // null
  const serNull = null
  expect(serializeActionCallArgument(null)).toEqual(serNull)
  expect(deserializeActionCallArgument(serNull)).toBe(null)

  // date
  const serDate = { $mobxKeystoneSerializer: `${namespace}/dateAsTimestamp`, value: 1000 }
  expect(serializeActionCallArgument(new Date(1000))).toEqual(serDate)
  expect(deserializeActionCallArgument(serDate)).toEqual(new Date(1000))

  // plain obj
  const obj = { x: 10 }
  const serObj = {
    $mobxKeystoneSerializer: `${namespace}/plainObject`,
    value: {
      x: 10,
    },
  }

  expect(serializeActionCallArgument(obj)).toEqual(serObj)
  expect(deserializeActionCallArgument(serObj)).toEqual(obj)

  // observable obj
  const obsObj = observable(obj)
  const serObsObj = serObj

  expect(serializeActionCallArgument(obsObj)).toEqual(serObsObj)
  expect(isObservable(serializeActionCallArgument(obsObj))).toBe(false)

  // array
  const arr = [obj, 20]
  const serArr = {
    $mobxKeystoneSerializer: `${namespace}/array`,
    value: [serObj, 20],
  }

  expect(serializeActionCallArgument(arr)).toEqual(serArr)
  expect(deserializeActionCallArgument(serArr)).toEqual(arr)

  // observable array
  const obsArr = observable(arr)
  const serObsArr = serArr

  expect(serializeActionCallArgument(obsArr)).toEqual(serObsArr)
  const serializedObsArr = serializeActionCallArgument(obsArr)
  expect(isObservable(serializedObsArr)).toBe(false)
  expect(isObservable((serializedObsArr as SerializedActionCallArgument).value[0])).toBe(false)

  // map
  const mapKV: [any, any][] = [
    ["x", 10],
    ["y", { z: 20 }],
  ]
  const map = new Map<any, any>(mapKV)
  const serMap = {
    $mobxKeystoneSerializer: `${namespace}/mapAsArray`,
    value: [
      ["x", 10],
      ["y", serializeActionCallArgument({ z: 20 })],
    ],
  }

  expect(serializeActionCallArgument(map)).toEqual(serMap)
  const mapBack: Map<any, any> = deserializeActionCallArgument(serMap)
  expect(mapBack instanceof Map).toBe(true)
  expect(Array.from(mapBack.entries())).toEqual(mapKV)

  // set
  const setK: any[] = ["x", { z: 20 }]
  const set = new Set<any>(setK)
  const serSet = {
    $mobxKeystoneSerializer: `${namespace}/setAsArray`,
    value: ["x", serializeActionCallArgument({ z: 20 })],
  }

  expect(serializeActionCallArgument(set)).toEqual(serSet)
  const setBack: Set<any> = deserializeActionCallArgument(serSet)
  expect(setBack instanceof Set).toBe(true)
  expect(Array.from(setBack.keys())).toEqual(setK)

  // model without shared root ref
  @testModel("SACM")
  class SACM extends Model({
    [modelIdKey]: idProp,
    child: prop<SACM | undefined>(),
  }) {}

  const r1 = new SACM({
    child: new SACM({}),
  })

  const r2 = new SACM({
    child: new SACM({}),
  })

  {
    expect(serializeActionCallArgument(r2, r1)).toEqual({
      $mobxKeystoneSerializer: `${namespace}/objectSnapshot`,
      value: getSnapshot(r2),
    })

    const serializedR2Child = serializeActionCallArgument(
      r2.child,
      r1
    ) as SerializedActionCallArgument
    expect(serializedR2Child.value).toBe(getSnapshot(r2.child))

    const deserializedR2Child = deserializeActionCallArgument(serializedR2Child, r1)
    expect(deserializedR2Child instanceof SACM).toBe(true)
    expect(deserializedR2Child).not.toBe(r2.child)
    expect(getSnapshot(deserializedR2Child)).toEqual(getSnapshot(r2.child))
  }

  // child model with shared root ref
  {
    const serializedR2Child = serializeActionCallArgument(r2.child, r2)
    expect(serializedR2Child).toEqual({
      $mobxKeystoneSerializer: `${namespace}/objectPath`,
      value: {
        targetPath: ["child"],
        targetPathIds: [r2.child!.$modelId],
      },
    })

    const deserializedR2Child = deserializeActionCallArgument(serializedR2Child, r2)
    expect(deserializedR2Child).toBe(r2.child)
  }

  // root model with shared root ref
  {
    const serializedR2Child = serializeActionCallArgument(r2, r2)
    expect(serializedR2Child).toEqual({
      $mobxKeystoneSerializer: `${namespace}/objectPath`,
      value: {
        targetPath: [],
        targetPathIds: [],
      },
    })

    const deserializedR2Child = deserializeActionCallArgument(serializedR2Child, r2)
    expect(deserializedR2Child).toBe(r2)
  }
})

describe("concurrency", () => {
  @testModel("TodoList")
  class TodoList extends Model({
    [modelIdKey]: idProp,
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
      todos.forEach((todo) => {
        this.remove(todo)
      })
    }
  }

  @testModel("Todo")
  class Todo extends Model({
    [modelIdKey]: idProp,
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
  const captured: SerializedActionCall[] = []
  beforeEach(() => {
    todoList = newTodoList()
    capturing = true
    captured.length = 0

    onActionMiddleware(todoList, {
      onStart(actionCall) {
        if (capturing) {
          captured.push(serializeActionCall(actionCall, todoList))
          return {
            result: ActionTrackingResult.Return,
            value: undefined,
          }
        }
        return undefined
      },
    })
  })

  function replicate(actionCall: SerializedActionCall) {
    capturing = false
    const ac = deserializeActionCall(actionCall, todoList)
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
    expect(() => {
      replicate(captured[1])
    }).toThrow('object at path ["list",1] with ids [null,"id-2"] could not be resolved')
  })

  test("remove same item twice", () => {
    // capture events
    todoList.remove(todoList.list[1])
    todoList.remove(todoList.list[1])

    expect(captured.length).toBe(2)
    // remove
    replicate(captured[0])
    // trying to remove already removed item
    expect(() => {
      replicate(captured[1])
    }).toThrow('object at path ["list",1] with ids [null,"id-2"] could not be resolved')
  })

  test("remove two and change text on third item", () => {
    // capture events
    todoList.removeMany([todoList.list[0], todoList.list[1]])
    todoList.list[2].setText("hello")

    expect(captured.length).toBe(2)
    // remove
    replicate(captured[0])
    // trying to change an item that moved to index 0 from index 2
    expect(() => {
      replicate(captured[1])
    }).toThrow('object at path ["list",2] with ids [null,"id-3"] could not be resolved')
  })

  test("remove 0,1 and 1,2", () => {
    // capture events
    todoList.removeMany([todoList.list[0], todoList.list[1]])
    todoList.removeMany([todoList.list[1], todoList.list[2]])

    expect(captured.length).toBe(2)
    // remove
    replicate(captured[0])
    // trying to remove an item that no longer exists
    expect(() => {
      replicate(captured[1])
    }).toThrow('object at path ["list",1] with ids [null,"id-2"] could not be resolved')
  })
})
