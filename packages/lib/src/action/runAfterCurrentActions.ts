import { when } from "mobx"

const alwaysTrue = () => true

/**
 * @ignore
 * @internal
 */
export function runAfterCurrentActions(action: () => void): void {
  // delay action until all current actions are finished
  when(alwaysTrue, action)
}
