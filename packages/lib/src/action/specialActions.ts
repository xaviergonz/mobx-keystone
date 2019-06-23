/**
 * An special action, an action which is built-in.
 */
export enum SpecialAction {
  /**
   * applyPatches
   */
  ApplyPatches = "$$applyPatches",
  /**
   * applyAction
   */
  ApplyAction = "$$applyAction",
  /**
   * applySnapshot
   */
  ApplySnapshot = "$$applySnapshot",
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

/**
 * Returns if a given action name is an special action, this is, one of:
 * - applyPatches()
 * - applyAction()
 * - applySnapshot()
 * - onInit() hook
 * - onAttachedToRootStore() hook
 * - disposer returned by a onAttachedToRootStore() hook
 *
 * @param actionName Action name to check.
 * @returns true if it is an special action, false otherwise.
 */
export function isSpecialAction(actionName: string): actionName is SpecialAction {
  return Object.values(SpecialAction).includes(actionName)
}

/**
 * Returns if a given action name corresponds to a hook, this is, one of:
 * - onInit() hook
 * - onAttachedToRootStore() hook
 * - disposer returned by a onAttachedToRootStore() hook
 *
 * @param actionName Action name to check.
 * @returns true if it is a hook, false otherwise.
 */
export function isHookAction(
  actionName: string
): actionName is
  | SpecialAction.OnAttachedToRootStore
  | SpecialAction.OnAttachedToRootStoreDisposer
  | SpecialAction.OnInit {
  switch (actionName) {
    case SpecialAction.OnAttachedToRootStore:
    case SpecialAction.OnAttachedToRootStoreDisposer:
    case SpecialAction.OnInit:
      return true
    default:
      return false
  }
}
