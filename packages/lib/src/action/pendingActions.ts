import { when } from "mobx"

const alwaysTrue = () => true

/**
 * @ignore
 */
export function enqueuePendingAction(action: () => void): void {
  // delay action until all current actions are finished
  when(alwaysTrue, action)
}
