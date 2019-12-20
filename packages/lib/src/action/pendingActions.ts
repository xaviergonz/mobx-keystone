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
export function runPendingActions(): void {
  while (pendingActions.length > 0) {
    const pendingAction = pendingActions.shift()!
    pendingAction()
  }
}
