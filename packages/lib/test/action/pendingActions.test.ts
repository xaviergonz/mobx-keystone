import { Model, prop, registerRootStore, runUnprotected, toTreeNode } from "../../src"
import { tryRunPendingActions } from "../../src/action/pendingActions"
import { testModel } from "../utils"

test("a failing root attachment does not postpone the remaining pending attachments", () => {
  const calls: string[] = []
  const error = new Error("attachment failed")
  @testModel("PendingAttachmentFailure")
  class Child extends Model({ name: prop<string>() }) {
    onAttachedToRootStore() {
      calls.push(this.name)
      if (this.name === "bad") throw error
    }
  }
  const root = registerRootStore(toTreeNode<Child[]>([]))
  try {
    expect(() =>
      runUnprotected(() => {
        root.push(new Child({ name: "bad" }), new Child({ name: "good" }))
      })
    ).toThrow(error)
    expect(calls).toEqual(["bad", "good"])
  } finally {
    // Do not leave pending work in module state when this regression fails.
    tryRunPendingActions()
  }
})
