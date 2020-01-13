import { assert, _ } from "spec.ts"
import {
  isRootStore,
  isTweakedObject,
  model,
  Model,
  modelAction,
  prop,
  registerRootStore,
  sandbox,
  SandboxManager,
  unregisterRootStore,
} from "../../src"
import "../commonSetup"
import { autoDispose } from "../utils"

@model("A")
class A extends Model({
  b: prop<B>(),
}) {}

@model("B")
class B extends Model({
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

  manager.withSandbox(a, node => {
    assert(node, _ as A)
    expect(node.$modelType).toBe("A")
    return false
  })

  manager.withSandbox([a], nodes => {
    assert(nodes, _ as [A])
    expect(nodes[0].$modelType).toBe("A")
    return false
  })

  manager.withSandbox([a, a], nodes => {
    assert(nodes, _ as [A, A])
    expect(nodes[0].$modelType).toBe("A")
    expect(nodes[1].$modelType).toBe("A")
    return false
  })

  manager.withSandbox([a, a.b], nodes => {
    assert(nodes, _ as [A, B])
    expect(nodes[0].$modelType).toBe("A")
    expect(nodes[1].$modelType).toBe("B")
    return false
  })

  manager.withSandbox([a.b, a], nodes => {
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

  manager.withSandbox(r.a, node => {
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

  manager.withSandbox(a, () => {
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
    manager.withSandbox(a, () => false)
  }).toThrow("node is not a child of subtreeRoot")
})

test("sandbox copy reuses IDs from original tree", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox(a, node => {
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
    manager.withSandbox(a.b, () => {
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

  manager.withSandbox(a.b, node1 => {
    node1.setValue(1)
    manager.withSandbox(node1, node2 => {
      expect(node2.value).toBe(1)
      node2.setValue(2)
      return commitInner
    })
    expect(node1.value).toBe(commitInner ? 2 : 1)
    return commitOuter
  })

  const expectedValue = commitOuter ? (commitInner ? 2 : 1) : 0

  expect(a.b.value).toBe(expectedValue)
  manager.withSandbox(a.b, node1 => {
    expect(node1.value).toBe(expectedValue)
    return false
  })
})

test("nested withSandbox call requires sandbox node", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox(a.b, () => {
    expect(() =>
      manager.withSandbox(a.b, () => {
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
  manager.withSandbox(a, node => {
    expect(isRootStore(node)).toBeFalsy()
    return false
  })

  registerRootStore(a)

  expect(isRootStore(a)).toBeTruthy()
  manager.withSandbox(a, node => {
    expect(isRootStore(node)).toBeTruthy()
    return false
  })

  unregisterRootStore(a)

  expect(isRootStore(a)).toBeFalsy()
  manager.withSandbox(a, node => {
    expect(isRootStore(node)).toBeFalsy()
    return false
  })
})

test("sandbox is patched when original tree changes", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox(a.b, node => {
    expect(node.value).toBe(0)
    return false
  })

  a.b.setValue(1)

  manager.withSandbox(a.b, node => {
    expect(node.value).toBe(1)
    return false
  })
})

test("changes in sandbox can be applied to original tree", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox(a.b, node => {
    node.setValue(1)
    expect(a.b.value).toBe(0)
    expect(node.value).toBe(1)

    node.setValue(2)
    expect(a.b.value).toBe(0)
    expect(node.value).toBe(2)

    return true
  })
  expect(a.b.value).toBe(2)

  manager.withSandbox(a.b, node => {
    expect(node.value).toBe(2)
    return false
  })
})

test("changes in sandbox can be rejected", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  manager.withSandbox(a.b, node => {
    node.setValue(1)
    expect(a.b.value).toBe(0)
    expect(node.value).toBe(1)

    node.setValue(2)
    expect(a.b.value).toBe(0)
    expect(node.value).toBe(2)

    return false
  })
  expect(a.b.value).toBe(0)

  manager.withSandbox(a.b, node => {
    expect(node.value).toBe(0)
    return false
  })
})

test("changes in sandbox are rejected when fn throws", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  expect(() => {
    manager.withSandbox(a.b, node => {
      node.setValue(1)
      expect(a.b.value).toBe(0)
      expect(node.value).toBe(1)
      throw new Error()
    })
  }).toThrow()

  expect(a.b.value).toBe(0)

  manager.withSandbox(a.b, node => {
    expect(node.value).toBe(0)
    return false
  })
})

test("withSandbox can return value from fn", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = sandbox(a)
  autoDispose(() => manager.dispose())

  const returnValue1 = manager.withSandbox(a.b, node => {
    node.setValue(1)
    return { commit: false, return: 123 }
  })
  assert(returnValue1, _ as number)
  expect(returnValue1).toBe(123)
  expect(a.b.value).toBe(0)

  const returnValue2 = manager.withSandbox(a.b, node => {
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
  manager.withSandbox(a.b, node => {
    n = node
    return false
  })

  expect(() => n.setValue(1)).toThrow("tried to invoke action 'setValue' over a readonly node")
})
