import { action, reaction, runInAction } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction } from "../utils"
import { getChildrenObjects } from "./getChildrenObjects"

/**
 * Runs a callback everytime a new object is attached to a given node.
 * The callback can optionally return a disposer which will be run when the child is detached.
 *
 * The optional options parameter accepts an object with the following options:
 * - `deep: boolean` (default: `false`) - true if the callback should be run for all children deeply
 * or false if it it should only run for shallow children.
 * - `fireForCurrentChildren: boolean` (default: `true`) - true if the callback should be immediately
 * called for currently attached children, false if only for future attachments.
 *
 * Returns a disposer, which has a boolean parameter which should be true if pending detachment
 * callbacks should be run or false otherwise.
 *
 * @param target Function that returns the object whose children should be tracked.
 * @param fn Callback called when a child is attached to the target object.
 * @param [options]
 * @returns
 */
export function onChildAttachedTo(
  target: () => object,
  fn: (child: object) => (() => void) | void,
  options?: {
    deep?: boolean
    fireForCurrentChildren?: boolean
  }
): (runDetachDisposers: boolean) => void {
  assertIsFunction(target, "target")
  assertIsFunction(fn, "fn")

  const opts = {
    deep: false,
    fireForCurrentChildren: true,
    ...options,
  }

  let disposed = false
  let runCleanupAfterDispose = false

  const detachDisposers = new WeakMap<object, () => void>()

  const runDetachDisposer = (n: object) => {
    const detachDisposer = detachDisposers.get(n)
    if (detachDisposer) {
      detachDisposers.delete(n)
      detachDisposer()
    }
  }

  const runDetachDisposers = (nodes: object[]) => {
    let firstError: { value: unknown } | undefined
    for (let i = nodes.length - 1; i >= 0; i--) {
      try {
        runDetachDisposer(nodes[i])
      } catch (value) {
        firstError ??= { value }
      }
    }
    return firstError
  }

  const addDetachDisposer = (n: object, disposer: (() => void) | void) => {
    if (disposer) {
      const detach = action(disposer)
      if (disposed) {
        if (runCleanupAfterDispose) detach()
      } else {
        detachDisposers.set(n, detach)
      }
    }
  }

  const getChildrenObjectOpts = { deep: opts.deep }
  const getCurrentChildren = () => {
    const t = target()
    assertTweakedObject(t, "target()")

    return new Set(getChildrenObjects(t, getChildrenObjectOpts))
  }

  const currentChildren = opts.fireForCurrentChildren ? new Set<object>() : getCurrentChildren()

  const disposer = reaction(
    () => getCurrentChildren(),
    (newChildren) => {
      const disposersToRun: object[] = []

      // find dead
      const currentChildrenIter = currentChildren.values()
      let currentChildrenCur = currentChildrenIter.next()
      while (!currentChildrenCur.done) {
        const n = currentChildrenCur.value
        if (!newChildren.has(n)) {
          currentChildren.delete(n)

          // we should run it in inverse order
          disposersToRun.push(n)
        }

        currentChildrenCur = currentChildrenIter.next()
      }

      let firstError = runDetachDisposers(disposersToRun)

      // find new
      const newChildrenIter = newChildren.values()
      let newChildrenCur = newChildrenIter.next()
      while (!disposed && !newChildrenCur.done) {
        const n = newChildrenCur.value
        if (!currentChildren.has(n)) {
          currentChildren.add(n)

          try {
            const detachAction = runInAction(() => fn(n))
            addDetachDisposer(n, detachAction)
          } catch (value) {
            firstError ??= { value }
          }
        }

        newChildrenCur = newChildrenIter.next()
      }
      if (firstError) {
        throw firstError.value
      }
    },
    {
      fireImmediately: true,
    }
  )

  return (runPendingDetachDisposers: boolean) => {
    if (disposed) return
    disposed = true
    runCleanupAfterDispose = runPendingDetachDisposers
    disposer()
    const pendingChildren = runPendingDetachDisposers ? Array.from(currentChildren) : []
    currentChildren.clear()
    const firstError = runDetachDisposers(pendingChildren)
    if (firstError) {
      throw firstError.value
    }
  }
}
