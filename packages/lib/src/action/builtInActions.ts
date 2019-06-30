/**
 * A built-in action.
 */
export enum BuiltInAction {
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
   * detach
   */
  Detach = "$$detach",
}

const builtInActionValues = new Set(Object.values(BuiltInAction))

/**
 * Returns if a given action name is a built-in action, this is, one of:
 * - applyPatches()
 * - applyAction()
 * - applySnapshot()
 * - detach()
 *
 * @param actionName Action name to check.
 * @returns true if it is a built-in action, false otherwise.
 */
export function isBuiltInAction(actionName: string): actionName is BuiltInAction {
  return builtInActionValues.has(actionName)
}
