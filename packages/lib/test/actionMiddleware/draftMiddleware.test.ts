import {
  DraftManager,
  draftMiddleware,
  isRootStore,
  model,
  Model,
  modelAction,
  prop,
  registerRootStore,
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

test("draftMiddleware creates instance of DraftManager", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = draftMiddleware(a)
  autoDispose(() => manager.dispose())
  expect(manager instanceof DraftManager).toBeTruthy()
})

test("withDraft callback is called when node is a child of subtreeRoot", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = draftMiddleware(a)
  autoDispose(() => manager.dispose())

  let called = false

  manager.withDraft(a, () => {
    called = true
  })
  expect(called).toBeTruthy()
})

test("withDraft throws a failure when node is not a child of subtreeRoot", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = draftMiddleware(a.b)
  autoDispose(() => manager.dispose())

  expect(() => {
    manager.withDraft(a, () => {})
  }).toThrow("node is not a child of subtreeRoot")
})

test("draft reuses IDs from original tree", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = draftMiddleware(a)
  autoDispose(() => manager.dispose())

  manager.withDraft(a, draft => {
    expect(draft.$modelId).toBe(a.$modelId)
    expect(draft.b.$modelId).toBe(a.b.$modelId)
  })
})

test("draft is a root store if original subtree root is a root store", () => {
  const a = new A({ b: new B({ value: 0 }) })
  autoDispose(() => {
    if (isRootStore(a)) {
      unregisterRootStore(a)
    }
  })
  const manager = draftMiddleware(a)
  autoDispose(() => manager.dispose())

  expect(isRootStore(a)).toBeFalsy()
  manager.withDraft(a, draft => {
    expect(isRootStore(draft)).toBeFalsy()
  })

  registerRootStore(a)

  expect(isRootStore(a)).toBeTruthy()
  manager.withDraft(a, draft => {
    expect(isRootStore(draft)).toBeTruthy()
  })

  unregisterRootStore(a)

  expect(isRootStore(a)).toBeFalsy()
  manager.withDraft(a, draft => {
    expect(isRootStore(draft)).toBeFalsy()
  })
})

test("draft is patched when original tree changes", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = draftMiddleware(a)
  autoDispose(() => manager.dispose())

  manager.withDraft(a.b, draft => {
    expect(draft.value).toBe(0)
  })

  a.b.setValue(1)

  manager.withDraft(a.b, draft => {
    expect(draft.value).toBe(1)
  })
})

test("changes in draft can be applied to original tree", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = draftMiddleware(a)
  autoDispose(() => manager.dispose())

  manager.withDraft(a.b, draft => {
    draft.setValue(1)
    expect(a.b.value).toBe(0)
    expect(draft.value).toBe(1)

    draft.setValue(2)
    expect(a.b.value).toBe(0)
    expect(draft.value).toBe(2)

    return true
  })
  expect(a.b.value).toBe(2)

  manager.withDraft(a.b, draft => {
    expect(draft.value).toBe(2)
  })
})

test("changes in draft can be rejected", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = draftMiddleware(a)
  autoDispose(() => manager.dispose())

  manager.withDraft(a.b, draft => {
    draft.setValue(1)
    expect(a.b.value).toBe(0)
    expect(draft.value).toBe(1)

    draft.setValue(2)
    expect(a.b.value).toBe(0)
    expect(draft.value).toBe(2)

    return false
  })
  expect(a.b.value).toBe(0)

  manager.withDraft(a.b, draft => {
    expect(draft.value).toBe(0)
  })
})

test("changes in draft are rejected when fn throws", () => {
  const a = new A({ b: new B({ value: 0 }) })
  const manager = draftMiddleware(a)
  autoDispose(() => manager.dispose())

  expect(() => {
    manager.withDraft(a.b, draft => {
      draft.setValue(1)
      expect(a.b.value).toBe(0)
      expect(draft.value).toBe(1)
      throw new Error()
    })
  }).toThrow()

  expect(a.b.value).toBe(0)

  manager.withDraft(a.b, draft => {
    expect(draft.value).toBe(0)
  })
})
