import { createContext } from "../context"
import { getRootPath } from "../parent/path"
import { deepEquals } from "../treeUtils/deepEquals"
import { TypeCheckError } from "./TypeCheckError"

export const validationContext = createContext<TypeCheckError | null>()

/**
 * Gets the validation result for the subtree of a node with the type check error path relative to
 * the node.
 *
 * @param node Tree node.
 * @returns `TypeCheckError` if there is an error, `null` if there is no error, and `undefined` if
 * model type validation is not enabled in the global config.
 */
export function getValidationResult(node: object): TypeCheckError | null | undefined {
  const error = validationContext.get(node)

  if (!error) {
    return error
  }

  const nodePath = getRootPath(node).path
  if (deepEquals(nodePath, error.path.slice(0, nodePath.length))) {
    return new TypeCheckError(
      error.path.slice(getRootPath(node).path.length),
      error.expectedTypeName,
      error.actualValue
    )
  }

  return null
}
