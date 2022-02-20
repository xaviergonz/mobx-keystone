import { action } from "mobx"
import { ActionContextActionType } from "../action/context"
import { HookAction } from "../action/hookActions"
import { wrapInAction, wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import type { AnyModel } from "../model/BaseModel"
import { _BaseModel } from "../model/_BaseModel"
import { walkTree, WalkTreeMode } from "../parent/walkTree"

const onAttachedDisposers = new WeakMap<object, () => void>()
const attachedToRootStore = new WeakSet<object>()

/**
 * @internal
 */
export const attachToRootStore = action(
  "attachToRootStore",
  (rootStore: object, child: object): void => {
    // we use an array to ensure they will get called even if the actual hook modifies the tree
    const childrenToCall: AnyModel[] = []

    walkTree(
      child,
      (ch) => {
        // we use this to avoid calling onAttachedToRootStore
        // twice
        if (attachedToRootStore.has(ch)) {
          return
        }
        attachedToRootStore.add(ch)

        if (ch instanceof _BaseModel && (ch as any).onAttachedToRootStore) {
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

    const childrenToCallLen = childrenToCall.length
    for (let i = 0; i < childrenToCallLen; i++) {
      const ch = childrenToCall[i]

      const disposer = (ch as any).onAttachedToRootStore!(rootStore)
      if (disposer) {
        onAttachedDisposers.set(ch, disposer)
      }
    }
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
        const disposerAction = wrapInAction({
          nameOrNameFn: HookAction.OnAttachedToRootStoreDisposer,
          fn: disposer,
          actionType: ActionContextActionType.Sync,
        }).bind(ch)
        onAttachedDisposers.delete(ch)

        disposersToCall.push(disposerAction)
      }
    },
    WalkTreeMode.ChildrenFirst
  )

  const disposersToCallLen = disposersToCall.length
  for (let i = 0; i < disposersToCallLen; i++) {
    disposersToCall[i]()
  }
})
