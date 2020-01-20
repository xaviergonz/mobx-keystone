import { reaction, runInAction } from "mobx"
import { runAfterCurrentActions } from "../action/runAfterCurrentActions"
import {
  readonlyMiddleware,
  ReadonlyMiddlewareReturn,
} from "../actionMiddlewares/readonlyMiddleware"
import { getParentToChildPath, resolvePath } from "../parent/path"
import { applyPatches } from "../patch/applyPatches"
import { onPatches } from "../patch/emitPatch"
import { PatchRecorder, patchRecorder } from "../patch/patchRecorder"
import { isRootStore, registerRootStore, unregisterRootStore } from "../rootStore/rootStore"
import { clone } from "../snapshot/clone"
import { assertTweakedObject, isTweakedObject } from "../tweaker/core"
import { assertIsFunction, failure } from "../utils"

/**
 * Callback function for `SandboxManager.withSandbox`.
 */
export type WithSandboxCallback<T extends object | [object], R> = (
  node: T
) => boolean | { commit: boolean; return: R }

/**
 * Manager class returned by `sandbox` that allows you to make changes to a sandbox copy of the
 * original subtree and apply them to the original subtree or reject them.
 */
export class SandboxManager {
  /**
   * The sandbox copy of the original subtree.
   */
  private readonly subtreeRootClone: object

  /**
   * The internal disposer.
   */
  private disposer: () => void

  /**
   * The internal `withSandbox` patch recorder. If `undefined`, no `withSandbox` call is being
   * executed.
   */
  private withSandboxPatchRecorder: PatchRecorder | undefined

  /**
   * `readonlyMiddleware` that will allow actions to be started inside the provided
   * code block on a readonly node.
   */
  private readonlyMw: ReadonlyMiddlewareReturn

  /**
   * Creates an instance of `SandboxManager`.
   * Do not use directly, use `sandbox` instead.
   *
   * @param subtreeRoot Subtree root target object.
   */
  constructor(private readonly subtreeRoot: object) {
    assertTweakedObject(subtreeRoot, "subtreeRoot")
    this.subtreeRootClone = clone(subtreeRoot, { generateNewIds: false })

    let wasRS = false
    const disposeReactionRS = reaction(
      () => isRootStore(subtreeRoot),
      isRS => {
        if (isRS !== wasRS) {
          wasRS = isRS
          if (isRS) {
            registerRootStore(this.subtreeRootClone)
          } else {
            unregisterRootStore(this.subtreeRootClone)
          }
        }
      },
      { fireImmediately: true }
    )

    const disposeOnPatches = onPatches(subtreeRoot, patches => {
      if (this.withSandboxPatchRecorder) {
        throw failure("original subtree must not change while 'withSandbox' executes")
      }

      const allowWriteFinisher = this.readonlyMw.allowWriteWithFinisher()
      try {
        applyPatches(this.subtreeRootClone, patches)
      } catch (err) {
        allowWriteFinisher()
        throw err
      }

      // ensure we only stop the write lock once current actions and triggered reactions up to applyPatches are finished
      runAfterCurrentActions(() => {
        allowWriteFinisher()
      })
    })

    this.readonlyMw = readonlyMiddleware(this.subtreeRootClone)

    this.disposer = () => {
      disposeReactionRS()
      disposeOnPatches()
      this.readonlyMw.dispose()
      if (isRootStore(this.subtreeRootClone)) {
        unregisterRootStore(this.subtreeRootClone)
      }
      this.disposer = () => {}
    }
  }

  /**
   * Executes `fn` with a sandbox copy of `node`. The changes made to the sandbox in `fn` can be
   * accepted, i.e. applied to the original subtree, or rejected.
   *
   * @typeparam T Object type.
   * @typeparam R Return type.
   * @param node Object or tuple of objects for which to obtain a sandbox copy.
   * @param fn Function that is called with a sandbox copy of `node`. Any changes made to the
   * sandbox are applied to the original subtree when `fn` returns `true` or
   * `{ commit: true, ... }`. When `fn` returns `false` or `{ commit: false, ... }` the changes made
   * to the sandbox are rejected.
   * @returns Value of type `R` when `fn` returns an object of type `{ commit: boolean; return: R }`
   * or `void` when `fn` returns a boolean.
   */
  withSandbox<T extends object | [object], R = void>(node: T, fn: WithSandboxCallback<T, R>): R {
    assertIsFunction(fn, "fn")

    const isNodesArray = Array.isArray(node) && !isTweakedObject(node, false)
    const nodes: T[] = isNodesArray ? (node as T[]) : [node]

    const { sandboxNodes, applyRecorderChanges } = this.prepareSandboxChanges(nodes)

    let commit = false
    try {
      const returnValue = this.readonlyMw.allowWrite(() =>
        fn((isNodesArray ? sandboxNodes : sandboxNodes[0]) as T)
      )
      if (typeof returnValue === "boolean") {
        commit = returnValue
        return undefined as any
      } else {
        commit = returnValue.commit
        return returnValue.return
      }
    } finally {
      applyRecorderChanges(commit)
    }
  }

  /**
   * Disposes of the sandbox.
   */
  dispose(): void {
    this.disposer()
  }

  private prepareSandboxChanges<T extends object[]>(
    nodes: T
  ): { sandboxNodes: T; applyRecorderChanges: (commit: boolean) => void } {
    const isNestedWithSandboxCall = !!this.withSandboxPatchRecorder

    const sandboxNodes = nodes.map(node => {
      assertTweakedObject(node, "node")

      const path = getParentToChildPath(
        isNestedWithSandboxCall ? this.subtreeRootClone : this.subtreeRoot,
        node
      )
      if (!path) {
        throw failure(`node is not a child of subtreeRoot${isNestedWithSandboxCall ? "Clone" : ""}`)
      }

      const sandboxNode = resolvePath<typeof node>(this.subtreeRootClone, path).value
      if (!sandboxNode) {
        throw failure("path could not be resolved - sandbox may be out of sync with original tree")
      }

      return sandboxNode
    }) as T

    if (!this.withSandboxPatchRecorder) {
      this.withSandboxPatchRecorder = patchRecorder(this.subtreeRootClone)
    }
    const recorder = this.withSandboxPatchRecorder
    const numRecorderEvents = recorder.events.length

    const applyRecorderChanges = (commit: boolean): void => {
      if (!isNestedWithSandboxCall) {
        recorder.dispose()
        this.withSandboxPatchRecorder = undefined
      }
      runInAction(() => {
        if (commit) {
          if (!isNestedWithSandboxCall) {
            const len = recorder.events.length
            for (let i = 0; i < len; i++) {
              applyPatches(this.subtreeRoot, recorder.events[i].patches)
            }
          }
        } else {
          this.readonlyMw.allowWrite(() => {
            let i = recorder.events.length
            while (i-- > numRecorderEvents) {
              applyPatches(this.subtreeRootClone, recorder.events[i].inversePatches, true)
            }
          })
        }
      })
    }

    return { sandboxNodes, applyRecorderChanges }
  }
}

/**
 * Creates a sandbox.
 *
 * @param subtreeRoot Subtree root target object.
 * @returns A `SandboxManager` which allows you to manage the sandbox operations and dispose of the
 * sandbox.
 */
export function sandbox(subtreeRoot: object): SandboxManager {
  return new SandboxManager(subtreeRoot)
}
