import { Model } from "../model/Model"
import { walkTree } from "../parent"

const attachDisposers = new WeakMap<object, () => void>()

export function attachToRootStore(rootStore: object, child: Model): void {
  walkTree(
    child,
    ch => {
      if (ch.attachedToRootStore) {
        const disposer = ch.attachedToRootStore(rootStore)
        if (disposer) {
          attachDisposers.set(ch, disposer)
        }
      }
    },
    "parentFirst"
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
    "childrenFirst"
  )
}
