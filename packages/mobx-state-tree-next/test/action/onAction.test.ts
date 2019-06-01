import { observable } from "mobx"
import {
  ActionContext,
  model,
  Model,
  modelAction,
  onAction,
  SerializableActionCall,
} from "../../src"
import { autoDispose } from "../withDisposers"

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

test("onAction", () => {
  const p1 = new P()
  const p2 = new P()

  const events: [SerializableActionCall, ActionContext][] = []
  function reset() {
    events.length = 0
  }

  const disposer = onAction(p1, (serAct, ctx, next) => {
    events.push([serAct, ctx])
    return next()
  })
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
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 0,
                },
              },
              "x": 1,
            },
          },
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
            "$$id": "mockedUuid-2",
            "$$typeof": "P2",
            "data": Object {
              "y": 2,
            },
          },
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
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
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
            Object {
              "$unserializable": true,
              "value": RandomClass {},
            },
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
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
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
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
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
            "$$id": "mockedUuid-1",
            "$$typeof": "P",
            "data": Object {
              "p2": P2 {
                "$$id": "mockedUuid-2",
                "$$typeof": "P2",
                "data": Object {
                  "y": 6,
                },
              },
              "x": 4,
            },
          },
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
