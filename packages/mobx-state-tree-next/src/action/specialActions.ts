export enum SpecialAction {
  ApplyPatches = "$$applyPatches",
  ApplyAction = "$$applyAction",
  ApplySnapshot = "$$applySnapshot",
  OnAttachedToRootStore = "$$onAttachedToRootStore",
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
