import { action } from "mobx"

const pendingActions: Array<() => void> = []

/**
 * @ignore
 */
export function enqueuePendingAction(action: () => void): void {
  pendingActions.push(action)
}

/**
 * @ignore
 */
export const runPendingActions = action("runPendingActions", () => {
  while (pendingActions.length > 0) {
    const pendingAction = pendingActions.shift()!
    pendingAction()
  }
})
