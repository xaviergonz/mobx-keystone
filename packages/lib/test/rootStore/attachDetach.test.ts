import {
  arrayActions,
  detach,
  Model,
  prop,
  registerRootStore,
  toTreeNode,
  unregisterRootStore,
} from "../../src"
import { testModel } from "../utils"

test.each([false, true])(
  "attachment cleanup survives moving during its hook (reattach: %s)",
  (reattach) => {
    const events: string[] = []
    const otherRoot = registerRootStore(toTreeNode<object[]>([]))
    @testModel(`ReentrantRootAttachment/${reattach}`)
    class Child extends Model({}) {
      onAttachedToRootStore(root: object) {
        const name = root === otherRoot ? "second" : "first"
        events.push(`attach ${name}`)
        if (name === "first") {
          detach(this)
          if (reattach) arrayActions.push(otherRoot, this)
        }
        return () => {
          events.push(`detach ${name}`)
        }
      }
    }
    const child = new Child({})
    const firstRoot = toTreeNode([child])
    try {
      registerRootStore(firstRoot)
      expect(events).toEqual(
        reattach
          ? ["attach first", "attach second", "detach first"]
          : ["attach first", "detach first"]
      )
      unregisterRootStore(otherRoot)
      if (reattach) expect(events.at(-1)).toBe("detach second")
    } finally {
      unregisterRootStore(firstRoot)
    }
  }
)

test("a node detached by an earlier sibling's hook does not get its attach hook", () => {
  const events: string[] = []
  @testModel("SiblingDetachingRootAttachment")
  class Child extends Model({ name: prop<string>() }) {
    onAttachedToRootStore() {
      events.push(`attach ${this.name}`)
      if (this.name === "a") detach(firstRoot[1])
      return () => {
        events.push(`detach ${this.name}`)
      }
    }
  }
  const firstRoot = toTreeNode([new Child({ name: "a" }), new Child({ name: "b" })])
  try {
    registerRootStore(firstRoot)
    expect(events).toEqual(["attach a"])
  } finally {
    unregisterRootStore(firstRoot)
  }
})
