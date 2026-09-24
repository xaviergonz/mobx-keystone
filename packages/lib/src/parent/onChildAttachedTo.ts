import { action, createAtom, reaction, runInAction } from "mobx"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction } from "../utils"
import {
  addObjectChildrenListener,
  type ObjectChildrenListener,
  removeObjectChildrenListener,
} from "./coreObjectChildren"
import { getChildrenObjects } from "./getChildrenObjects"
import { compareTreePaths, getPathFromAncestor } from "./treeOrder"

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

  const { deep = false, fireForCurrentChildren = true } = options ?? {}

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

  const runDetachDisposers = (nodes: readonly object[]) => {
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

  const getChildrenObjectOpts = { deep }
  const getTarget = () => {
    const t = target()
    assertTweakedObject(t, "target()")
    return t
  }

  /** Children the callback ran for, with increasing numbers in the order it did. */
  const currentChildren = new Map<object, number>()
  let lastChildOrder = 0

  const updateChildren = (dead: readonly object[], born: Iterable<object>) => {
    for (const n of dead) {
      currentChildren.delete(n)
    }
    // we should run them in inverse order
    let firstError = runDetachDisposers(dead)

    for (const n of born) {
      if (disposed) {
        break
      }
      currentChildren.set(n, ++lastChildOrder)

      try {
        const detachAction = runInAction(() => fn(n))
        addDetachDisposer(n, detachAction)
      } catch (value) {
        firstError ??= { value }
      }
    }
    if (firstError) {
      throw firstError.value
    }
  }

  const updateChildrenByDiff = (newChildren: ReadonlySet<object>) => {
    const dead: object[] = []
    for (const n of currentChildren.keys()) {
      if (!newChildren.has(n)) {
        dead.push(n)
      }
    }
    const born: object[] = []
    for (const n of newChildren) {
      if (!currentChildren.has(n)) {
        born.push(n)
      }
    }
    updateChildren(dead, born)
  }

  /** Updates the children given the only nodes that may have been attached or detached. */
  const updateChildrenIncrementally = (t: object, nodes: ReadonlySet<object>) => {
    const dead: object[] = []
    const born: { node: object; path: object[] }[] = []
    for (const node of nodes) {
      const path = getPathFromAncestor(t, node, false)
      const isChild = path !== undefined && (deep || path.length === 1)
      if (currentChildren.has(node)) {
        if (!isChild) {
          dead.push(node)
        }
      } else if (isChild) {
        born.push({ node, path })
      }
    }
    // same orders as a diff: the old children in the order they were added,
    // and the new ones in the order of the children set
    dead.sort((a, b) => currentChildren.get(a)! - currentChildren.get(b)!)
    born.sort((a, b) => compareTreePaths(a.path, b.path, true))
    updateChildren(
      dead,
      born.map((b) => b.node)
    )
  }

  // nodes that may have been attached to or detached from the target since
  // the last update
  let touched = new Set<object>()
  const touchedAtom = createAtom("onChildAttachedTo")
  const listener: ObjectChildrenListener = {
    deep,
    onChildrenChanged(nodes) {
      for (const n of nodes) {
        touched.add(n)
      }
      touchedAtom.reportChanged()
    },
  }
  let listenedTarget: object | undefined

  const stopListening = () => {
    if (listenedTarget) {
      removeObjectChildrenListener(listenedTarget, listener)
      listenedTarget = undefined
    }
    touched = new Set()
  }

  const update = (t: object) => {
    if (t !== listenedTarget) {
      stopListening()
      addObjectChildrenListener(t, listener)
      listenedTarget = t
      updateChildrenByDiff(getChildrenObjects(t, getChildrenObjectOpts))
      return
    }

    const nodes = touched
    touched = new Set()
    // (even when most children changed, this is about as fast as a diff)
    if (nodes.size > 0) {
      updateChildrenIncrementally(t, nodes)
    }
  }

  if (!fireForCurrentChildren) {
    for (const n of getChildrenObjects(getTarget(), getChildrenObjectOpts)) {
      currentChildren.set(n, ++lastChildOrder)
    }
  }

  const disposer = reaction(
    () => {
      const t = getTarget()
      touchedAtom.reportObserved()
      // a new object, so every change runs the effect
      return { t }
    },
    ({ t }) => {
      update(t)
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
    stopListening()
    const pendingChildren = runPendingDetachDisposers ? Array.from(currentChildren.keys()) : []
    currentChildren.clear()
    const firstError = runDetachDisposers(pendingChildren)
    if (firstError) {
      throw firstError.value
    }
  }
}
