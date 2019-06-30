/**
 * A hook action.
 */
export enum HookAction {
  /**
   * onInit hook
   */
  OnInit = "$$onInit",
  /**
   * onAttachedToRootStore hook
   */
  OnAttachedToRootStore = "$$onAttachedToRootStore",
  /**
   * disposer for onAttachedToRootStore hook
   */
  OnAttachedToRootStoreDisposer = "$$onAttachedToRootStoreDisposer",
}

const hookActionValues = new Set(Object.values(HookAction))

/**
 * Returns if a given action name corresponds to a hook, this is, one of:
 * - onInit() hook
 * - onAttachedToRootStore() hook
 * - disposer returned by a onAttachedToRootStore() hook
 *
 * @param actionName Action name to check.
 * @returns true if it is a hook, false otherwise.
 */
export function isHookAction(actionName: string): actionName is HookAction {
  return hookActionValues.has(actionName)
}
