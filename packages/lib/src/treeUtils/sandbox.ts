import { reaction, runInAction } from "mobx"
import {
  readonlyMiddleware,
  ReadonlyMiddlewareReturn,
} from "../actionMiddlewares/readonlyMiddleware"
import { createContext } from "../context"
import { getParentToChildPath, resolvePath } from "../parent/path"
import { applyPatches } from "../patch/applyPatches"
import { onPatches } from "../patch/emitPatch"
import { Patch } from "../patch/Patch"
import { PatchRecorder, patchRecorder } from "../patch/patchRecorder"
import { isRootStore, registerRootStore, unregisterRootStore } from "../rootStore/rootStore"
import { clone } from "../snapshot/clone"
import { assertTweakedObject } from "../tweaker/core"
import { assertIsFunction, failure } from "../utils"

/**
 * Context that allows access to the sandbox manager this node runs under (if any).
 */
const sandboxManagerContext = createContext<SandboxManager>()

/**
 * Returns the sandbox manager of a node, or `undefined` if none.
 *
 * @param node Node to check.
 * @returns The sandbox manager of a node, or `undefined` if none.
 */
export function getNodeSandboxManager(node: object): SandboxManager | undefined {
  return sandboxManagerContext.get(node)
}

/**
 * Returns if a given node is a sandboxed node.
 *
 * @param node Node to check.
 * @returns `true` if it is sandboxed, `false`
 */
export function isSandboxedNode(node: object): boolean {
  return !!getNodeSandboxManager(node)
}

/**
 * Callback function for `SandboxManager.withSandbox`.
 */
export type WithSandboxCallback<T extends readonly [object, ...object[]], R> = (
  ...nodes: T
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
   * Function from `readonlyMiddleware` that will allow actions to be started inside the provided
   * code block on a readonly node.
   */
  private allowWrite: ReadonlyMiddlewareReturn["allowWrite"]

  /**
   * Whether changes made in the sandbox are currently being committed to the original subtree.
   */
  private isComitting: boolean = false

  /**
   * Creates an instance of `SandboxManager`.
   * Do not use directly, use `sandbox` instead.
   *
   * @param subtreeRoot Subtree root target object.
   */
  constructor(private readonly subtreeRoot: object) {
    assertTweakedObject(subtreeRoot, "subtreeRoot")

    // we temporarily set the default value of the context manager so that
    // cloned nodes can access it while in their onInit phase

    let previousContextDefault = sandboxManagerContext.getDefault()
    sandboxManagerContext.setDefault(this)
    try {
      this.subtreeRootClone = clone(subtreeRoot, { generateNewIds: false })
      sandboxManagerContext.set(this.subtreeRootClone, this)
    } catch (err) {
      throw err
    } finally {
      sandboxManagerContext.setDefault(previousContextDefault)
    }

    let wasRS = false
    const disposeReactionRS = reaction(
      () => isRootStore(subtreeRoot),
      (isRS) => {
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

    const disposeOnPatches = onPatches(subtreeRoot, (patches) => {
      if (this.withSandboxPatchRecorder) {
        throw failure("original subtree must not change while 'withSandbox' executes")
      }
      if (!this.isComitting) {
        this.allowWrite(() => {
          applyPatches(this.subtreeRootClone, patches)
        })
      }
    })

    const { allowWrite, dispose: disposeReadonlyMW } = readonlyMiddleware(this.subtreeRootClone)
    this.allowWrite = allowWrite

    this.disposer = () => {
      disposeReactionRS()
      disposeOnPatches()
      disposeReadonlyMW()
      if (isRootStore(this.subtreeRootClone)) {
        unregisterRootStore(this.subtreeRootClone)
      }
      this.disposer = () => {}
    }
  }

  /**
   * Executes `fn` with sandbox copies of the elements of `nodes`. The changes made to the sandbox
   * in `fn` can be accepted, i.e. applied to the original subtree, or rejected.
   *
   * @typeparam T Object type.
   * @typeparam R Return type.
   * @param nodes Tuple of objects for which to obtain sandbox copies.
   * @param fn Function that is called with sandbox copies of the elements of `nodes`. Any changes
   * made to the sandbox are applied to the original subtree when `fn` returns `true` or
   * `{ commit: true, ... }`. When `fn` returns `false` or `{ commit: false, ... }` the changes made
   * to the sandbox are rejected.
   * @returns Value of type `R` when `fn` returns an object of type `{ commit: boolean; return: R }`
   * or `void` when `fn` returns a boolean.
   */
  withSandbox<T extends readonly [object, ...object[]], R = void>(
    nodes: T,
    fn: WithSandboxCallback<T, R>
  ): R {
    for (let i = 0; i < nodes.length; i++) {
      assertTweakedObject(nodes[i], `nodes[${i}]`)
    }
    assertIsFunction(fn, "fn")

    const { sandboxNodes, applyRecorderChanges } = this.prepareSandboxChanges(nodes)

    let commit = false
    try {
      const returnValue = this.allowWrite(() => fn(...sandboxNodes))
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

  private prepareSandboxChanges<T extends readonly [object, ...object[]]>(
    nodes: T
  ): { sandboxNodes: T; applyRecorderChanges: (commit: boolean) => void } {
    const isNestedWithSandboxCall = !!this.withSandboxPatchRecorder

    const sandboxNodes = (nodes.map((node) => {
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
    }) as unknown) as T

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
      if (commit) {
        if (!isNestedWithSandboxCall) {
          const patches: Patch[] = []
          const len = recorder.events.length
          for (let i = 0; i < len; i++) {
            patches.push(...recorder.events[i].patches)
          }
          this.isComitting = true
          applyPatches(this.subtreeRoot, patches)
          this.isComitting = false
        }
      } else {
        this.allowWrite(() => {
          runInAction(() => {
            let i = recorder.events.length
            while (i-- > numRecorderEvents) {
              applyPatches(this.subtreeRootClone, recorder.events[i].inversePatches, true)
            }
          })
        })
      }
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
