import { observable } from "mobx"
import {
  ActionCall,
  ActionContext,
  addActionMiddleware,
  applySnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  onActionMiddleware,
  serializeActionCallArgument,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("P2")
export class P2 extends Model {
  data = {
    y: 0,
  }

  @modelAction
  addY = (n: number) => {
    this.data.y += n
    return this.data.y
  }
}

@model("P")
export class P extends Model {
  data = {
    p2: new P2(),
    x: 0,
  }

  @modelAction
  addX(n: number, _unserializable?: any) {
    this.data.x += n
    return this.data.x
  }

  @modelAction
  other(..._any: any[]) {}

  @modelAction
  addXY(n1: number, n2: number) {
    this.addX(n1)
    this.data.p2.addY(n2)
    return n1 + n2
  }
}

test("onActionMiddleware", () => {
  const p1 = new P()
  const p2 = new P()

  const events: [ActionCall, ActionContext][] = []
  function reset() {
    events.length = 0
  }

  const recorder = onActionMiddleware({ model: p1 }, (actionCall, ctx, next) => {
    events.push([actionCall, ctx])
    return next()
  })

  const disposer = addActionMiddleware(recorder)
  autoDispose(disposer)

  // action on the root
  p1.addX(1)
  p2.addX(1)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "args": Array [
            1,
          ],
          "name": "addX",
          "path": Array [],
        },
        Object {
          "args": Array [
            1,
          ],
          "data": Object {},
          "name": "addX",
          "parentContext": undefined,
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P",
            },
            "data": Object {
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-2",
                  "type": "P2",
                },
                "data": Object {
                  "y": 0,
                },
              },
              "x": 1,
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // action on the child
  reset()
  p1.data.p2.addY(2)
  p2.data.p2.addY(2)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "args": Array [
            2,
          ],
          "name": "addY",
          "path": Array [
            "data",
            "p2",
          ],
        },
        Object {
          "args": Array [
            2,
          ],
          "data": Object {},
          "name": "addY",
          "parentContext": undefined,
          "target": P2 {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P2",
            },
            "data": Object {
              "y": 2,
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // action on the root with sub-action on the child
  reset()
  p1.addXY(3, 4)
  p2.addXY(3, 4)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "args": Array [
            3,
            4,
          ],
          "name": "addXY",
          "path": Array [],
        },
        Object {
          "args": Array [
            3,
            4,
          ],
          "data": Object {},
          "name": "addXY",
          "parentContext": undefined,
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P",
            },
            "data": Object {
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-2",
                  "type": "P2",
                },
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // unserializable args
  reset()
  class RandomClass {}
  const rc = new RandomClass()

  p1.other(rc)
  p2.other(rc)
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "args": Array [
            RandomClass {},
          ],
          "name": "other",
          "path": Array [],
        },
        Object {
          "args": Array [
            RandomClass {},
          ],
          "data": Object {},
          "name": "other",
          "parentContext": undefined,
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P",
            },
            "data": Object {
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-2",
                  "type": "P2",
                },
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // array, obs array
  reset()
  p1.other([1, 2, 3], observable([4, 5, 6]))
  p2.other([1, 2, 3], observable([4, 5, 6]))
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "args": Array [
            Array [
              1,
              2,
              3,
            ],
            Array [
              4,
              5,
              6,
            ],
          ],
          "name": "other",
          "path": Array [],
        },
        Object {
          "args": Array [
            Array [
              1,
              2,
              3,
            ],
            Array [
              4,
              5,
              6,
            ],
          ],
          "data": Object {},
          "name": "other",
          "parentContext": undefined,
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P",
            },
            "data": Object {
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-2",
                  "type": "P2",
                },
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // obj, obs obj
  reset()
  p1.other({ a: 5 }, observable({ a: 5 }))
  p2.other({ a: 5 }, observable({ a: 5 }))
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "args": Array [
            Object {
              "a": 5,
            },
            Object {
              "a": 5,
            },
          ],
          "name": "other",
          "path": Array [],
        },
        Object {
          "args": Array [
            Object {
              "a": 5,
            },
            Object {
              "a": 5,
            },
          ],
          "data": Object {},
          "name": "other",
          "parentContext": undefined,
          "target": P {
            "$$metadata": Object {
              "id": "mockedUuid-1",
              "type": "P",
            },
            "data": Object {
              "p2": P2 {
                "$$metadata": Object {
                  "id": "mockedUuid-2",
                  "type": "P2",
                },
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // applySnapshot
  reset()
  applySnapshot(p1.data.p2, {
    ...getSnapshot(p1.data.p2),
    y: 100,
  })
  applySnapshot(p2.data.p2, {
    ...getSnapshot(p2.data.p2),
    y: 100,
  })
  expect(events).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "args": Array [
            Object {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P2",
              },
              "y": 100,
            },
          ],
          "name": "$$applySnapshot",
          "path": Array [
            "data",
            "p2",
          ],
        },
        Object {
          "args": Array [
            Object {
              "$$metadata": Object {
                "id": "mockedUuid-2",
                "type": "P2",
              },
              "y": 100,
            },
          ],
          "data": Object {},
          "name": "$$applySnapshot",
          "parentContext": undefined,
          "target": P2 {
            "$$metadata": Object {
              "id": "mockedUuid-2",
              "type": "P2",
            },
            "data": Object {
              "y": 100,
            },
          },
          "type": "sync",
        },
      ],
    ]
  `)

  // disposing
  reset()
  disposer()
  p1.addXY(5, 6)
  p2.addXY(5, 6)
  expect(events).toMatchInlineSnapshot(`Array []`)
})

test("serializeActionCallArgument", () => {
  // unserializable args
  class RandomClass {}
  const rc = new RandomClass()

  expect(() => serializeActionCallArgument(rc)).toThrow(
    "serializeActionCallArgument could not serialize the given value"
  )

  // TODO: unit test the good cases
})
