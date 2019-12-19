import { canWrite } from "./protection"

const pendingActions: Array<() => void> = []

/**
 * @ignore
 */
export function enqueueOrRunPendingAction(action: () => void): void {
  if (!canWrite()) {
    action()
  } else {
    pendingActions.push(action)
  }
}

/**
 * @ignore
 */
export function runPendingActions(): void {
  while (pendingActions.length > 0 && !canWrite()) {
    const pendingAction = pendingActions.shift()!
    pendingAction()
  }
}
