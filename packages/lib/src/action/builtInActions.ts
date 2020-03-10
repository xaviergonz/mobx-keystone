/**
 * A built-in action.
 */
export enum BuiltInAction {
  /**
   * applyPatches
   */
  ApplyPatches = "$$applyPatches",
  /**
   * applySnapshot
   */
  ApplySnapshot = "$$applySnapshot",
  /**
   * detach
   */
  Detach = "$$detach",
  /**
   * applySet
   */
  ApplySet = "$$applySet",
  /**
   * applyDelete
   */
  ApplyDelete = "$$applyDelete",
  /**
   * applyMethodCall
   */
  ApplyMethodCall = "$$applyMethodCall",
}

const builtInActionValues = new Set(Object.values(BuiltInAction))

/**
 * Returns if a given action name is a built-in action, this is, one of:
 * - applyPatches()
 * - applySnapshot()
 * - detach()
 *
 * @param actionName Action name to check.
 * @returns true if it is a built-in action, false otherwise.
 */
export function isBuiltInAction(actionName: string): actionName is BuiltInAction {
  return builtInActionValues.has(actionName as BuiltInAction)
}
