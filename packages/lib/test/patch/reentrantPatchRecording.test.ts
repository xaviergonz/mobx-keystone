import {
  Model,
  modelAction,
  onDeepChange,
  onGlobalPatches,
  onPatches,
  type Patch,
  patchRecorder,
  prop,
  runUnprotected,
  toTreeNode,
  transactionMiddleware,
  undoMiddleware,
  withoutUndo,
} from "../../src"
import { autoDispose, testModel } from "../utils"

@testModel("reentrant-recording")
class RecordingRoot extends Model({ x: prop(0), y: prop(0) }) {
  @modelAction change() {
    this.x = 1
  }
}

test.each(["global", "manager"] as const)("%s withoutUndo inside deep change listener", (scope) => {
  const root = new RecordingRoot({})
  const undo = undoMiddleware(root)
  autoDispose(() => undo.dispose())
  autoDispose(
    onDeepChange(root, (change) => {
      if ("key" in change && change.key === "x" && root.x === 1)
        (scope === "global" ? withoutUndo : undo.withoutUndo.bind(undo))(() => {
          root.y = 1
        })
    })
  )
  root.change()
  undo.undo()
  expect(root.x).toBe(0)
  expect(root.y).toBe(1)
})

test("recorder scoped to listener edit", () => {
  const root = toTreeNode({ x: 0, y: 0 })
  let count = -1
  autoDispose(
    onPatches(root, (patches) => {
      if (patches[0].path[0] !== "x") return
      const recorder = patchRecorder(root)
      root.y = 1
      count = recorder.events.length
      recorder.dispose()
    })
  )
  runUnprotected(() => {
    root.x = 1
  })
  expect(count).toBe(1)
})

@testModel("reentrant-transaction")
class TransactionRoot extends Model({ value: prop(0) }) {
  @modelAction fail() {
    this.value = 1
    throw new Error("failed")
  }
}

test.each(["patch", "deep change"] as const)(
  "transactional action triggered from a %s listener rolls back",
  (kind) => {
    const source = toTreeNode({ x: 0 })
    const target = new TransactionRoot({})
    autoDispose(transactionMiddleware({ model: target, actionName: "fail" }))
    autoDispose(
      (kind === "patch" ? onPatches : onDeepChange)(source, () => {
        expect(() => target.fail()).toThrow("failed")
      })
    )
    runUnprotected(() => {
      source.x = 1
    })
    expect(target.value).toBe(0)
  }
)

test("a recorder's recording flag is sampled within a reentrant edit", () => {
  const root = toTreeNode({ x: 0, y: 0 })
  const recorder = patchRecorder(root, { recording: false })
  autoDispose(() => recorder.dispose())
  autoDispose(
    onDeepChange(root, (change) => {
      if (!("key" in change) || change.key !== "x") return
      recorder.recording = true
      root.y = 1
      recorder.recording = false
    })
  )
  runUnprotected(() => {
    root.x = 1
  })
  expect(recorder.events.map((event) => event.patches)).toEqual([
    [{ op: "replace", path: ["y"], value: 1 }],
  ])
})

test.each([false, true])(
  "new patch listeners do not receive earlier queued changes (global: %s)",
  (global) => {
    const root = toTreeNode({ x: 0, y: 0 })
    const received: Patch[] = []
    // Ensure notifications for the original mutation are already queued.
    autoDispose(onPatches(root, () => {}))
    autoDispose(onGlobalPatches(() => {}))
    autoDispose(
      onDeepChange(root, (change) => {
        if (!("key" in change) || change.key !== "x") return
        autoDispose(
          global
            ? onGlobalPatches((target, patches) => {
                if (target === root) received.push(...patches)
              })
            : onPatches(root, (patches) => received.push(...patches))
        )
        root.y = 1
      })
    )
    runUnprotected(() => {
      root.x = 1
    })
    expect(received).toEqual([{ op: "replace", path: ["y"], value: 1 }])
  }
)
