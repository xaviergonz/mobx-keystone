import { ActionContextActionType } from "../action/context"
import { SpecialAction } from "../action/specialActions"
import { wrapInAction, wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { AnyModel, Model } from "../model/Model"
import { walkTree, WalkTreeMode } from "../parent/walkTree"

const onAttachedDisposers = new WeakMap<object, () => void>()

/**
 * @ignore
 */
export function attachToRootStore(rootStore: AnyModel, child: AnyModel): void {
  walkTree(
    child,
    ch => {
      if (ch instanceof Model && ch.onAttachedToRootStore) {
        wrapModelMethodInActionIfNeeded(
          ch,
          "onAttachedToRootStore",
          SpecialAction.OnAttachedToRootStore
        )

        const disposer = ch.onAttachedToRootStore(rootStore)
        if (disposer) {
          // wrap disposer in action
          const disposerAction = wrapInAction(
            SpecialAction.OnAttachedToRootStoreDisposer,
            disposer,
            ActionContextActionType.Sync
          )
          onAttachedDisposers.set(ch, disposerAction)
        }
      }
    },
    WalkTreeMode.ParentFirst
  )
}

/**
 * @ignore
 */
export function detachFromRootStore(child: AnyModel): void {
  walkTree(
    child,
    ch => {
      const disposerAction = onAttachedDisposers.get(ch)
      if (disposerAction) {
        onAttachedDisposers.delete(ch)
        disposerAction.call(ch)
      }
    },
    WalkTreeMode.ChildrenFirst
  )
}
