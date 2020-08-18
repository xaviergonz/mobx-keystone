import { getCurrentActionContext } from "./context"
import { getActionProtection } from "./protection"

const pendingActions: (() => void)[] = []

function isActionRunning() {
  return !getActionProtection() || getCurrentActionContext()
}

/**
 * @ignore
 */
export function enqueuePendingAction(action: () => void): void {
  // delay action until all current actions are finished
  if (isActionRunning()) {
    pendingActions.push(action)
  } else {
    action()
  }
}

/**
 * @ignore
 */
export function tryRunPendingActions(): boolean {
  if (isActionRunning()) {
    return false
  }

  while (pendingActions.length > 0) {
    const nextAction = pendingActions.shift()!
    nextAction()
  }
  return true
}
