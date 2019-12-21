import { reaction, runInAction } from "mobx"
import { getParentToChildPath, resolvePath } from "../parent"
import { applyPatches, onPatches, patchRecorder } from "../patch"
import { isRootStore, registerRootStore, unregisterRootStore } from "../rootStore"
import { clone } from "../snapshot"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"

/**
 * Callback function for `DraftManager.withDraft`.
 */
export type WithDraftCallback<T extends object> = (draftNode: T) => boolean | undefined | void

/**
 * Manager class returned by `draftMiddleware` that allows you to make changes to a draft copy of
 * the original subtree and apply them to the original subtree or reject them.
 */
export class DraftManager {
  /**
   * The draft copy of the original subtree.
   */
  private readonly subtreeRootDraft: object

  /**
   * The internal disposer.
   */
  private disposer: () => void

  /**
   * Creates an instance of `DraftManager`.
   * Do not use directly, use `draftMiddleware` instead.
   *
   * @param subtreeRoot Subtree root target object.
   */
  constructor(private readonly subtreeRoot: object) {
    assertTweakedObject(subtreeRoot, "subtreeRoot")
    this.subtreeRootDraft = clone(subtreeRoot, { generateNewIds: false })

    let wasRS = false
    const disposeReactionRS = reaction(
      () => isRootStore(subtreeRoot),
      isRS => {
        if (isRS !== wasRS) {
          wasRS = isRS
          if (isRS) {
            registerRootStore(this.subtreeRootDraft)
          } else {
            unregisterRootStore(this.subtreeRootDraft)
          }
        }
      },
      { fireImmediately: true }
    )

    const disposeOnPatches = onPatches(subtreeRoot, patches =>
      applyPatches(this.subtreeRootDraft, patches)
    )

    this.disposer = () => {
      disposeReactionRS()
      disposeOnPatches()
      if (isRootStore(this.subtreeRootDraft)) {
        unregisterRootStore(this.subtreeRootDraft)
      }
      this.disposer = () => {}
    }
  }

  /**
   * Executes `fn` with a draft of `node`. The changes made to the draft in `fn` can be accepted,
   * i.e. applied to the original subtree, or rejected.
   *
   * @typeparam T Object type.
   * @param node Object for which to obtain a draft copy.
   * @param fn Function that is called with a draft copy of `node`. Any changes made to the draft
   * are applied to the original subtree when `fn` returns `true`. When `fn` returns `false`,
   * `undefined` or nothing, the changes made to the draft are rejected.
   */
  withDraft<T extends object>(node: T, fn: WithDraftCallback<T>): void {
    assertTweakedObject(node, "node")

    const path = getParentToChildPath(this.subtreeRoot, node)
    if (!path) {
      throw failure("node is not a child of subtreeRoot")
    }

    const draftNode = resolvePath<T>(this.subtreeRootDraft, path).value
    if (!draftNode) {
      throw failure("path could not be resolved - draft may be out of sync with original tree")
    }

    const recorder = patchRecorder(this.subtreeRootDraft)
    let accept: ReturnType<typeof fn> = false
    try {
      accept = fn(draftNode)
    } finally {
      recorder.dispose()
      runInAction(() => {
        if (accept) {
          const len = recorder.events.length
          for (let i = 0; i < len; i++) {
            applyPatches(this.subtreeRoot, recorder.events[i].patches)
          }
        } else {
          let i = recorder.events.length
          while (i--) {
            applyPatches(this.subtreeRootDraft, recorder.events[i].inversePatches)
          }
        }
      })
    }
  }

  /**
   * Disposes the draft middleware.
   */
  dispose(): void {
    this.disposer()
  }
}

/**
 * Creates a draft middleware.
 *
 * @param subtreeRoot Subtree root target object.
 * @returns A `DraftManager` which allows you to do the manage the draft operations and dispose of
 * the middleware.
 */
export function draftMiddleware(subtreeRoot: object): DraftManager {
  return new DraftManager(subtreeRoot)
}
