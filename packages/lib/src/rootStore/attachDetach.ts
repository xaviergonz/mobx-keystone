import { action } from "mobx"
import { ActionContextActionType } from "../action/context"
import { HookAction } from "../action/hookActions"
import { wrapInAction, wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { AnyModel, BaseModel } from "../model/BaseModel"
import { walkTree, WalkTreeMode } from "../parent/walkTree"

const onAttachedDisposers = new WeakMap<object, () => void>()

/**
 * @ignore
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
        if (ch instanceof BaseModel && ch.onAttachedToRootStore) {
          wrapModelMethodInActionIfNeeded(
            ch,
            "onAttachedToRootStore",
            HookAction.OnAttachedToRootStore
          )
          childrenToCall.push(ch)
        }
      },
      WalkTreeMode.ParentFirst
    )

    const childrenToCallLen = childrenToCall.length
    for (let i = 0; i < childrenToCallLen; i++) {
      const ch = childrenToCall[i]

      const disposer = ch.onAttachedToRootStore!(rootStore)
      if (disposer) {
        onAttachedDisposers.set(ch, disposer)
      }
    }
  }
)

/**
 * @ignore
 * @internal
 */
export const detachFromRootStore = action("detachFromRootStore", (child: object): void => {
  // we use an array to ensure they will get called even if the actual hook modifies the tree
  const disposersToCall: (() => void)[] = []

  walkTree(
    child,
    (ch) => {
      const disposer = onAttachedDisposers.get(ch)
      if (disposer) {
        // wrap disposer in action
        const disposerAction = wrapInAction({
          name: HookAction.OnAttachedToRootStoreDisposer,
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
