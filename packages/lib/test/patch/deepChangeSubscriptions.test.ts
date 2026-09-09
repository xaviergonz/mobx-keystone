import { action } from "mobx"
import { onDeepChange, onGlobalDeepChange, runUnprotected, toTreeNode } from "../../src"
import { autoDispose } from "../utils"

test.each(["subtree", "global"] as const)(
  "%s listeners can unsubscribe themselves without skipping others",
  (kind) => {
    const root = toTreeNode({ value: 0 })
    const subscribe = (listener: () => void) =>
      kind === "global" ? onGlobalDeepChange(listener) : onDeepChange(root, listener)
    const seen: string[] = []
    const stop = subscribe(() => {
      seen.push("first")
      stop()
    })
    autoDispose(stop)
    autoDispose(
      subscribe(() => {
        seen.push("second")
      })
    )
    runUnprotected(() => {
      root.value = 1
    })
    runUnprotected(() => {
      root.value = 2
    })
    expect(seen).toEqual(["first", "second", "second"])
  }
)

test.each(["subtree", "global"] as const)(
  "%s subscriptions added during delivery start with the next mutation",
  (kind) => {
    const root = toTreeNode({ value: 0 })
    const subscribe = (listener: () => void) =>
      kind === "global" ? onGlobalDeepChange(listener) : onDeepChange(root, listener)
    const seen: string[] = []
    const stop = subscribe(() => {
      seen.push("first")
      stop()
      autoDispose(
        subscribe(() => {
          seen.push("new")
        })
      )
    })
    autoDispose(stop)
    autoDispose(
      subscribe(() => {
        seen.push("second")
      })
    )
    runUnprotected(() => {
      root.value = 1
    })
    expect(seen).toEqual(["first", "second"])
    runUnprotected(() => {
      root.value = 2
    })
    expect(seen).toEqual(["first", "second", "second", "new"])
  }
)

test.each(["subtree", "global"] as const)(
  "%s duplicate callbacks have independent idempotent disposers",
  (kind) => {
    const root = toTreeNode({ value: 0 })
    const subscribe = (listener: () => void) =>
      kind === "global" ? onGlobalDeepChange(listener) : onDeepChange(root, listener)
    const seen: string[] = []
    const listener = action(() => {
      seen.push("first")
    })
    autoDispose(subscribe(listener))
    autoDispose(
      subscribe(() => {
        seen.push("second")
      })
    )
    const stop = subscribe(listener)
    autoDispose(stop)
    stop()
    stop()
    runUnprotected(() => {
      root.value = 1
    })
    expect(seen).toEqual(["first", "second"])
  }
)

test.each(["subtree", "global"] as const)(
  "%s subscriptions disposed during delivery do not receive the in-flight change",
  (kind) => {
    const root = toTreeNode({ value: 0 })
    const subscribe = (listener: () => void) =>
      kind === "global" ? onGlobalDeepChange(listener) : onDeepChange(root, listener)
    const seen: string[] = []
    autoDispose(
      subscribe(() => {
        seen.push("first")
        stopSecond()
      })
    )
    const stopSecond = subscribe(() => {
      seen.push("second")
    })
    autoDispose(stopSecond)
    runUnprotected(() => {
      root.value = 1
    })
    expect(seen).toEqual(["first"])
  }
)
