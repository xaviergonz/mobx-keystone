import { action } from "mobx"
import { ActionContextActionType } from "../action/context"
import { HookAction } from "../action/hookActions"
import { wrapInAction, wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { type AnyModel, BaseModel } from "../model/BaseModel"
import { WalkTreeMode, walkTree } from "../parent/walkTree"
import { forEachWithDelayedThrow } from "../utils/forEachWithDelayedThrow"

const onAttachedDisposers = new WeakMap<object, () => void>()
const attachedToRootStore = new WeakMap<object, object>()

/**
 * @internal
 */
export const attachToRootStore = action(
  "attachToRootStore",
  (rootStore: object, child: object): void => {
    // we use an array to ensure they will get called even if the actual hook modifies the tree
    const childrenToCall: AnyModel[] = []
    const attachment = {}

    walkTree(
      child,
      (ch) => {
        // we use this to avoid calling onAttachedToRootStore
        // twice
        if (attachedToRootStore.has(ch)) {
          return
        }
        attachedToRootStore.set(ch, attachment)

        if (ch instanceof BaseModel && (ch as any).onAttachedToRootStore) {
          wrapModelMethodInActionIfNeeded(
            ch as any,
            "onAttachedToRootStore",
            HookAction.OnAttachedToRootStore
          )

          childrenToCall.push(ch as AnyModel)
        }
      },
      WalkTreeMode.ParentFirst
    )

    forEachWithDelayedThrow(childrenToCall, (ch) => {
      // An earlier hook may have detached or reattached this node already.
      if (attachedToRootStore.get(ch) !== attachment) {
        return
      }

      const disposer = (ch as any).onAttachedToRootStore(rootStore)
      if (disposer) {
        if (attachedToRootStore.get(ch) === attachment) {
          onAttachedDisposers.set(ch, disposer)
        } else {
          // The hook detached or reattached this node before returning its cleanup.
          // Dispose this attachment without overwriting a newer attachment's cleanup.
          wrapDisposer(ch, disposer)()
        }
      }
    })
  }
)

/**
 * @internal
 */
export const detachFromRootStore = action("detachFromRootStore", (child: object): void => {
  // we use an array to ensure they will get called even if the actual hook modifies the tree
  const disposersToCall: (() => void)[] = []

  walkTree(
    child,
    (ch) => {
      if (!attachedToRootStore.delete(ch)) {
        return
      }

      const disposer = onAttachedDisposers.get(ch)
      if (disposer) {
        // wrap disposer in action
        const disposerAction = wrapDisposer(ch, disposer)
        onAttachedDisposers.delete(ch)

        disposersToCall.push(disposerAction)
      }
    },
    WalkTreeMode.ChildrenFirst
  )

  forEachWithDelayedThrow(disposersToCall, (dispose) => dispose())
})

function wrapDisposer(node: object, disposer: () => void): () => void {
  return wrapInAction({
    nameOrNameFn: HookAction.OnAttachedToRootStoreDisposer,
    fn: disposer,
    actionType: ActionContextActionType.Sync,
  }).bind(node)
}
