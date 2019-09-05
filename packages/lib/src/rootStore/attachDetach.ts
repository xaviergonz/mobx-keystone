import { ActionContextActionType } from "../action/context"
import { HookAction } from "../action/hookActions"
import { wrapInAction, wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { AnyModel, BaseModel } from "../model/BaseModel"
import { walkTree, WalkTreeMode } from "../parent/walkTree"

const onAttachedDisposers = new WeakMap<object, () => void>()

/**
 * @ignore
 */
export function attachToRootStore(rootStore: object, child: object): void {
  // delay the calling of hooks until the end in case the tree gets modified by one of them
  const nodes: AnyModel[] = []

  walkTree(
    child,
    ch => {
      if (ch instanceof BaseModel && ch.onAttachedToRootStore) {
        nodes.push(ch)
      }
    },
    WalkTreeMode.ParentFirst
  )

  const nodesLen = nodes.length
  for (let i = 0; i < nodesLen; i++) {
    const ch = nodes[i]

    wrapModelMethodInActionIfNeeded(ch, "onAttachedToRootStore", HookAction.OnAttachedToRootStore)

    const disposer = ch.onAttachedToRootStore!(rootStore)
    if (disposer) {
      onAttachedDisposers.set(ch, disposer)
    }
  }
}

/**
 * @ignore
 */
export function detachFromRootStore(child: object): void {
  // delay the calling of hooks until the end in case the tree gets modified by one of them
  const nodes: [object, () => void][] = []

  walkTree(
    child,
    ch => {
      const disposerAction = onAttachedDisposers.get(ch)
      if (disposerAction) {
        nodes.push([ch, disposerAction])
      }
    },
    WalkTreeMode.ChildrenFirst
  )

  const nodesLen = nodes.length
  for (let i = 0; i < nodesLen; i++) {
    const [ch, disposer] = nodes[i]
    // wrap disposer in action
    const disposerAction = wrapInAction(
      HookAction.OnAttachedToRootStoreDisposer,
      disposer,
      ActionContextActionType.Sync
    )
    onAttachedDisposers.delete(ch)
    disposerAction.call(ch)
  }
}
