import { failure } from "../utils"
import { getCurrentActionContext } from "./context"

/**
 * @ignore
 * @internal
 */
export function canWrite(): boolean {
  return !getActionProtection() || !!getCurrentActionContext()
}

/**
 * @ignore
 * @internal
 */
export function assertCanWrite() {
  if (!canWrite()) {
    throw failure("data changes must be performed inside model actions")
  }
}

let actionProtection = true

/**
 * @ignore
 * @internal
 *
 * Gets if the action protection is currently enabled or not.
 *
 * @returns
 */
export function getActionProtection() {
  return actionProtection
}

/**
 * @ignore
 * @internal
 *
 * Sets if the action protection is currently enabled or not.
 */
export function setActionProtection(protection: boolean) {
  actionProtection = protection
}
