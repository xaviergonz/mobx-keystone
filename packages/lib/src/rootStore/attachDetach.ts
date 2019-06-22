import { ActionContextActionType } from "../action/context"
import { SpecialAction } from "../action/specialActions"
import { wrapInAction } from "../action/wrapInAction"
import { AnyModel, Model } from "../model/Model"
import { walkTree, WalkTreeMode } from "../parent/walkTree"

const onAttachedAsModelAction = new WeakMap<Function, AnyModel["onAttachedToRootStore"]>()
const onAttachedDisposers = new WeakMap<object, () => void>()

/**
 * @ignore
 */
export function attachToRootStore(rootStore: AnyModel, child: AnyModel): void {
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
