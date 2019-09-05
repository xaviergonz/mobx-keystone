import { ActionContextActionType } from "../action/context"
import { HookAction } from "../action/hookActions"
import { wrapInAction, wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { BaseModel } from "../model/BaseModel"
import { walkTree, WalkTreeMode } from "../parent/walkTree"

const onAttachedDisposers = new WeakMap<object, () => void>()

/**
 * @ignore
 */
export function attachToRootStore(rootStore: object, child: object): void {
  walkTree(
    child,
    ch => {
      if (ch instanceof BaseModel && ch.onAttachedToRootStore) {
        wrapModelMethodInActionIfNeeded(
          ch,
          "onAttachedToRootStore",
          HookAction.OnAttachedToRootStore
        )

        const disposer = ch.onAttachedToRootStore(rootStore)
        if (disposer) {
          onAttachedDisposers.set(ch, disposer)
        }
      }
    },
    WalkTreeMode.ParentFirst
  )
}

/**
 * @ignore
 */
export function detachFromRootStore(child: object): void {
  walkTree(
    child,
    ch => {
      const disposer = onAttachedDisposers.get(ch)
      if (disposer) {
        // wrap disposer in action
        const disposerAction = wrapInAction(
          HookAction.OnAttachedToRootStoreDisposer,
          disposer,
          ActionContextActionType.Sync
        )
        onAttachedDisposers.delete(ch)
        disposerAction.call(ch)
      }
    },
    WalkTreeMode.ChildrenFirst
  )
}
