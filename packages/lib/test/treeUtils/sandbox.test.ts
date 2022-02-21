import { computed, toJS } from "mobx"
import { assert, _ } from "spec.ts"
import {
  customRef,
  getNodeSandboxManager,
  getParent,
  idProp,
  isRootStore,
  isSandboxedNode,
  isTweakedObject,
  model,
  Model,
  modelAction,
  modelIdKey,
  prop,
  Ref,
  registerRootStore,
  runUnprotected,
  sandbox,
  SandboxManager,
  undoMiddleware,
  unregisterRootStore,
} from "../../src"
import { autoDispose } from "../utils"

@model("A")
class A extends Model({
  [modelIdKey]: idProp,
  b: prop<B>(),
}) {}

@model("B")
class B extends Model({
  [modelIdKey]: idProp,
  value: prop<number>(),
}) {
  @modelAction
  setValue(value: number): void {
    this.value = value
  }
}

test("sandbox creates instance of SandboxManager", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())
  expect(manager instanceof SandboxManager).toBeTruthy()
})

test("withSandbox can be called with one node or a tuple of nodes", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox([a], (node) => {
    assert(node, _ as A)
    expect(node.$modelType).toBe("A")
    return false
  })

  manager.withSandbox([a], (...nodes) => {
    assert(nodes, _ as [A])
    expect(nodes[0].$modelType).toBe("A")
    return false
  })

  manager.withSandbox([a, a], (...nodes) => {
    assert(nodes, _ as [A, A])
    expect(nodes[0].$modelType).toBe("A")
    expect(nodes[1].$modelType).toBe("A")
    return false
  })

  manager.withSandbox([a, a.b], (...nodes) => {
    assert(nodes, _ as [A, B])
    expect(nodes[0].$modelType).toBe("A")
    expect(nodes[1].$modelType).toBe("B")
    return false
  })

  manager.withSandbox([a.b, a], (...nodes) => {
    assert(nodes, _ as [B, A])
    expect(nodes[0].$modelType).toBe("B")
    expect(nodes[1].$modelType).toBe("A")
    return false
  })
})

test("withSandbox can be called with an array node", () => {
  @model("R")
  class R extends Model({ a: prop<A[]>() }) {}

  const r = new R({ a: [new A({ b: new B({ value: 1 }) }), new A({ b: new B({ value: 2 }) })] })

  const manager = sandbox(r)
  autoDispose(() => manager.dispose())

  manager.withSandbox([r.a], (node) => {
    assert(node, _ as A[])
    expect(node).toHaveLength(2)
    expect(isTweakedObject(node, false)).toBeTruthy()
    return false
  })
})

test("withSandbox callback is called when node is a child of subtreeRoot", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  let called = false

  manager.withSandbox([a], () => {
    called = true
    return false
  })
  expect(called).toBeTruthy()
})

test("withSandbox throws a failure when node is not a child of subtreeRoot", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a.b)
  autoDispose(() => manager.dispose())

  expect(() => {
    manager.withSandbox([a], () => false)
  }).toThrow("node is not a child of subtreeRoot")
})

test("sandbox copy reuses IDs from original tree", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox([a], (node) => {
    expect(node.$modelId).toBe(a.$modelId)
    expect(node.b.$modelId).toBe(a.b.$modelId)
    return false
  })
})

test("original tree must not be changed while withSandbox executes", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  expect(() =>
    manager.withSandbox([a.b], () => {
      a.b.setValue(2)
      return false
    })
  ).toThrow("original subtree must not change while 'withSandbox' executes")
})

test.each<[boolean, boolean]>([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])("withSandbox calls can be nested (%j - %j)", (commitInner, commitOuter) => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox([a.b], (node1) => {
    node1.setValue(1)
    manager.withSandbox([node1], (node2) => {
      expect(node2.value).toBe(1)
      node2.setValue(2)
      return commitInner
    })
    expect(node1.value).toBe(commitInner ? 2 : 1)
    return commitOuter
  })

  const expectedValue = commitOuter ? (commitInner ? 2 : 1) : 0

  expect(a.b.value).toBe(expectedValue)
  manager.withSandbox([a.b], (node1) => {
    expect(node1.value).toBe(expectedValue)
    return false
  })
})

test("nested withSandbox call requires sandbox node", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox([a.b], () => {
    expect(() =>
      manager.withSandbox([a.b], () => {
        return false
      })
    ).toThrow("node is not a child of subtreeRootClone")
    return false
  })
})

test("sandbox node is a root store if original subtree root is a root store", () => {
  const a = new A({ b: new B({ value: 0 }) })
  autoDispose(() => {
    if (isRootStore(a)) {
      unregisterRootStore(a)
    }
  })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  expect(isRootStore(a)).toBeFalsy()
  manager.withSandbox([a], (node) => {
    expect(isRootStore(node)).toBeFalsy()
    return false
  })

  registerRootStore(a)

  expect(isRootStore(a)).toBeTruthy()
  manager.withSandbox([a], (node) => {
    expect(isRootStore(node)).toBeTruthy()
    return false
  })

  unregisterRootStore(a)

  expect(isRootStore(a)).toBeFalsy()
  manager.withSandbox([a], (node) => {
    expect(isRootStore(node)).toBeFalsy()
    return false
  })
})

test("sandbox is patched when original tree changes", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox([a.b], (node) => {
    expect(node.value).toBe(0)
    return false
  })

  a.b.setValue(1)

  manager.withSandbox([a.b], (node) => {
    expect(node.value).toBe(1)
    return false
  })
})

test("changes in sandbox can be applied to original tree - idempotent action", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox([a.b], (node) => {
    node.setValue(1)
    expect(a.b.value).toBe(0)
    expect(node.value).toBe(1)

    node.setValue(2)
    expect(a.b.value).toBe(0)
    expect(node.value).toBe(2)

    return true
  })
  expect(a.b.value).toBe(2)

  manager.withSandbox([a.b], (node) => {
    expect(node.value).toBe(2)
    return false
  })
})

test("changes in sandbox can be applied to original tree - non-idempotent action", () => {
  @model("C")
  class C extends Model({
    values: prop<number[]>(),
  }) {
    @modelAction
    append(value: number): void {
      this.values.push(value)
    }
  }

  const c = new C({ values: [] })
  const manager = sandbox(c)
  autoDispose(() => manager.dispose())

  manager.withSandbox([c], (node) => {
    node.append(10)
    node.append(11)
    expect(c.values).toEqual([])
    expect(toJS(node.values)).toEqual([10, 11])
    return true
  })
  expect(toJS(c.values)).toEqual([10, 11])

  manager.withSandbox([c], (node) => {
    expect(toJS(node.values)).toEqual([10, 11])
    return false
  })
})

test("changes in sandbox can be rejected", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox([a.b], (node) => {
    node.setValue(1)
    expect(a.b.value).toBe(0)
    expect(node.value).toBe(1)

    node.setValue(2)
    expect(a.b.value).toBe(0)
    expect(node.value).toBe(2)

    return false
  })
  expect(a.b.value).toBe(0)

  manager.withSandbox([a.b], (node) => {
    expect(node.value).toBe(0)
    return false
  })
})

test("changes in sandbox are rejected when fn throws", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  expect(() => {
    manager.withSandbox([a.b], (node) => {
      node.setValue(1)
      expect(a.b.value).toBe(0)
      expect(node.value).toBe(1)
      throw new Error()
    })
  }).toThrow()

  expect(a.b.value).toBe(0)

  manager.withSandbox([a.b], (node) => {
    expect(node.value).toBe(0)
    return false
  })
})

test("withSandbox can return value from fn", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  const returnValue1 = manager.withSandbox([a.b], (node) => {
    node.setValue(1)
    return { commit: false, return: 123 }
  })
  assert(returnValue1, _ as number)
  expect(returnValue1).toBe(123)
  expect(a.b.value).toBe(0)

  const returnValue2 = manager.withSandbox([a.b], (node) => {
    node.setValue(1)
    return { commit: true, return: { x: "x" } }
  })
  assert(returnValue2, _ as { x: string })
  expect(returnValue2).toEqual({ x: "x" })
  expect(a.b.value).toBe(1)
})

test("sandbox cannot be changed outside of fn", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  let n!: B
  manager.withSandbox([a.b], (node) => {
    n = node
    return false
  })

  expect(() => n.setValue(1)).toThrow("tried to invoke action 'setValue' over a readonly node")
})

test("sanboxed nodes can check if they are sandboxed", () => {
  const initEvents: string[] = []

  @model("A2")
  class A2 extends Model({
    b: prop<B2>(),
  }) {
    onInit() {
      initEvents.push(`A2 init: ${isSandboxedNode(this)}`)
    }

    onAttachedToRootStore() {
      initEvents.push(`A2 attached: ${isSandboxedNode(this)}`)
    }

    @computed
    get isSandboxed() {
      return isSandboxedNode(this)
    }

    @modelAction
    shouldBeSandboxed(shouldBeSandboxed: boolean): void {
      expect(isSandboxedNode(this)).toBe(shouldBeSandboxed)
    }
  }

  @model("B2")
  class B2 extends Model({
    value: prop<number>(),
  }) {
    onInit() {
      initEvents.push(`B2 init: ${isSandboxedNode(this)}`)
    }

    onAttachedToRootStore() {
      initEvents.push(`B2 attached: ${isSandboxedNode(this)}`)
    }

    @computed
    get isSandboxed() {
      return isSandboxedNode(this)
    }

    @modelAction
    shouldBeSandboxed(shouldBeSandboxed: boolean): void {
      expect(isSandboxedNode(this)).toBe(shouldBeSandboxed)
    }
  }

  const a = new A2({ b: new B2({ value: 0 }) })
  registerRootStore(a)
  autoDispose(() => {
    if (isRootStore(a)) {
      unregisterRootStore(a)
    }
  })

  expect(initEvents).toMatchInlineSnapshot(`
    Array [
      "B2 init: false",
      "A2 init: false",
      "A2 attached: false",
      "B2 attached: false",
    ]
  `)
  initEvents.length = 0

  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  expect(initEvents).toMatchInlineSnapshot(`
    Array [
      "B2 init: true",
      "A2 init: true",
      "A2 attached: true",
      "B2 attached: true",
    ]
  `)
  initEvents.length = 0

  expect(getNodeSandboxManager(a)).toBeUndefined()
  expect(isSandboxedNode(a)).toBe(false)
  expect(getNodeSandboxManager(a.b)).toBeUndefined()
  expect(isSandboxedNode(a.b)).toBe(false)

  expect(a.isSandboxed).toBe(false)
  a.shouldBeSandboxed(false)
  expect(a.b.isSandboxed).toBe(false)
  a.b.shouldBeSandboxed(false)

  manager.withSandbox([a], (sa) => {
    expect(getNodeSandboxManager(sa)).toBe(manager)
    expect(isSandboxedNode(sa)).toBe(true)
    expect(getNodeSandboxManager(sa.b)).toBe(manager)
    expect(isSandboxedNode(sa.b)).toBe(true)

    expect(sa.isSandboxed).toBe(true)
    sa.shouldBeSandboxed(true)
    expect(sa.b.isSandboxed).toBe(true)
    sa.b.shouldBeSandboxed(true)

    return false
  })
})

test("isSandboxedNode recognizes ref/prev/next to all be sandboxed nodes or not sandboxed nodes", () => {
  const aRef = customRef<A>("aRef", {
    resolve(ref: Ref<A>): A | undefined {
      const maybeR = getParent<R>(ref)
      return maybeR ? maybeR.a : undefined
    },
    onResolvedValueChange(ref, next, prev) {
      if (next) {
        expect(isSandboxedNode(ref)).toBe(isSandboxedNode(next))
      }
      if (prev) {
        // false since it is already detached
        expect(isSandboxedNode(prev)).toBe(false)
      }
    },
  })

  @model("R3")
  class R extends Model({ a: prop<A | undefined>(), aref: prop<Ref<A> | undefined>() }) {}

  const a = new A({ b: new B({ value: 0 }) })
  const r = new R({})
  const manager = sandbox(r)
  autoDispose(() => manager.dispose())

  runUnprotected(() => {
    r.aref = aRef(a)
  })

  runUnprotected(() => {
    r.a = a
  })

  runUnprotected(() => {
    r.a = undefined
  })
})

test("sandbox commit patches are grouped in a single undo item", () => {
  const b = new B({ value: 0 })
  const sandboxManager = sandbox(b)
  const undoManager = undoMiddleware(b)

  expect(undoManager.undoLevels).toBe(0)
  expect(undoManager.redoLevels).toBe(0)

  sandboxManager.withSandbox([b], (node) => {
    node.setValue(1)
    node.setValue(2)
    return { return: undefined, commit: true }
  })

  expect(undoManager.undoLevels).toBe(1)
  expect(undoManager.redoLevels).toBe(0)
  expect(undoManager.undoQueue).toMatchInlineSnapshot(`
    Array [
      Object {
        "actionName": "$$applyPatches",
        "attachedState": Object {
          "afterEvent": undefined,
          "beforeEvent": undefined,
        },
        "inversePatches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "value",
            ],
            "value": 0,
          },
          Object {
            "op": "replace",
            "path": Array [
              "value",
            ],
            "value": 1,
          },
        ],
        "patches": Array [
          Object {
            "op": "replace",
            "path": Array [
              "value",
            ],
            "value": 1,
          },
          Object {
            "op": "replace",
            "path": Array [
              "value",
            ],
            "value": 2,
          },
        ],
        "targetPath": Array [],
        "type": "single",
      },
    ]
  `)
})
