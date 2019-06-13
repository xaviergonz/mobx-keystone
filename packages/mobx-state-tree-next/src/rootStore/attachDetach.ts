import { ActionContextActionType } from "../action/context"
import { SpecialAction } from "../action/SpecialAction"
import { wrapInAction } from "../action/wrapInAction"
import { Model } from "../model/Model"
import { walkTree, WalkTreeMode } from "../parent/walkTree"

const onAttachedAsModelAction = new WeakMap<Function, Model["onAttachedToRootStore"]>()
const onAttachedDisposers = new WeakMap<object, () => void>()

export function attachToRootStore(rootStore: Model, child: Model): void {
  walkTree(
    child,
    ch => {
      if (ch instanceof Model && ch.onAttachedToRootStore) {
        // wrap method in action or reuse from cache
        let attachedAction = onAttachedAsModelAction.get(ch.onAttachedToRootStore)
        if (!attachedAction) {
          attachedAction = wrapInAction(
            SpecialAction.OnAttachedToRootStore,
            ch.onAttachedToRootStore,
            ActionContextActionType.Sync
          )
          onAttachedAsModelAction.set(ch.onAttachedToRootStore, attachedAction)
        }

        const disposer = attachedAction.call(ch, rootStore)
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

export function detachFromRootStore(child: Model): void {
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
