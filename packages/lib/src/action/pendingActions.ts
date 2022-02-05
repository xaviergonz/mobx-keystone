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

let pendingActionsRunning = false

/**
 * @ignore
 */
export function tryRunPendingActions(): void {
  if (isActionRunning() || pendingActionsRunning) {
    return
  }

  pendingActionsRunning = true

  try {
    while (pendingActions.length > 0) {
      const nextAction = pendingActions.shift()!
      nextAction()
    }
  } finally {
    pendingActionsRunning = false
  }
}
