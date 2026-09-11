import { reaction } from "mobx"
import {
  isRootStore,
  MobxKeystoneAggregateError,
  Model,
  prop,
  registerRootStore,
  toTreeNode,
  unregisterRootStore,
} from "../../src"
import { testModel } from "../utils"

test.each(["attach", "detach"])(
  "root-store status remains reactive when %s hooks throw",
  (phase) => {
    @testModel("ThrowingRootHook")
    class M extends Model({}) {
      onAttachedToRootStore() {
        if (phase === "attach") throw new Error("hook error")
        return () => {
          throw new Error("hook error")
        }
      }
    }
    const root = new M({})
    const seen: boolean[] = []
    const dispose = reaction(
      () => isRootStore(root),
      (value) => {
        seen.push(value)
      }
    )
    try {
      if (phase === "attach") {
        expect(() => registerRootStore(root)).toThrow("hook error")
        expect(isRootStore(root)).toBe(true)
        expect(seen).toEqual([true])
      } else {
        registerRootStore(root)
        expect(() => unregisterRootStore(root)).toThrow("hook error")
        expect(isRootStore(root)).toBe(false)
        expect(seen).toEqual([true, false])
      }
    } finally {
      dispose()
    }
  }
)

test.each(["attach", "detach"])("%s hooks continue after a sibling throws", (phase) => {
  const seen: string[] = []
  @testModel("SiblingHookErrors")
  class M extends Model({ name: prop<string>() }) {
    onAttachedToRootStore() {
      if (phase === "attach") {
        seen.push(this.name)
        if (this.name === "first") throw new Error("first error")
      }
      return () => {
        if (phase === "detach") {
          seen.push(this.name)
          if (this.name === "first") throw new Error("first error")
        }
      }
    }
  }
  const root = toTreeNode({ first: new M({ name: "first" }), second: new M({ name: "second" }) })
  if (phase === "attach") {
    expect(() => registerRootStore(root)).toThrow("first error")
  } else {
    registerRootStore(root)
    expect(() => unregisterRootStore(root)).toThrow("first error")
  }
  expect(seen).toEqual(["first", "second"])
})

test("several failing attachment hooks are grouped in a MobxKeystoneAggregateError", () => {
  @testModel("MultipleThrowingRootHooks")
  class M extends Model({ name: prop<string>() }) {
    onAttachedToRootStore() {
      throw new Error(this.name)
    }
  }
  const root = toTreeNode({ first: new M({ name: "first" }), second: new M({ name: "second" }) })
  let caught: unknown
  try {
    registerRootStore(root)
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(MobxKeystoneAggregateError)
  expect((caught as MobxKeystoneAggregateError).errors.map((e) => (e as Error).message)).toEqual([
    "first",
    "second",
  ])
  expect(isRootStore(root)).toBe(true)
})
