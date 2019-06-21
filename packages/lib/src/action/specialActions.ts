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
 * - onAttachedToRootStore() hook
 * - disposer returned by a onAttachedToRootStore() hook
 *
 * @param actionName Action name to check.
 * @returns true if it is an special action, false otherwise.
 */
export function isSpecialAction(actionName: string): actionName is SpecialAction {
  return Object.values(SpecialAction).includes(actionName)
}
