import { Model } from "../model/Model"
import { walkTree, WalkTreeMode } from "../parent"

const attachDisposers = new WeakMap<object, () => void>()

export function attachToRootStore(rootStore: Model, child: Model): void {
  walkTree(
    child,
    ch => {
      if (ch instanceof Model && ch.attachedToRootStore) {
        const disposer = ch.attachedToRootStore(rootStore)
        if (disposer) {
          attachDisposers.set(ch, disposer)
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
      const disposer = attachDisposers.get(ch)
      if (disposer) {
        attachDisposers.delete(ch)
        disposer()
      }
    },
    WalkTreeMode.ChildrenFirst
  )
}
