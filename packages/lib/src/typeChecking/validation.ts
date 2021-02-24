import fastDeepEqual from "fast-deep-equal/es6"
import { createContext } from "../context"
import { getRootPath } from "../parent/path"
import { transformTypeCheckErrors, TypeCheckErrors } from "./TypeCheckErrors"

export const validationContext = createContext<TypeCheckErrors | null>()

/**
 * Gets the validation result for the subtree of a node with the type check error path relative to
 * the node.
 *
 * @param node Tree node.
 * @returns `TypeCheckErrors` if there are errors, `null` if there is no error, and `undefined` if
 * model type validation is not enabled in the global config.
 */
export function getValidationResult(node: object): TypeCheckErrors | null | undefined {
  const errors = validationContext.get(node)

  if (!errors) {
    return errors
  }

  const nodePath = getRootPath(node).path
  return transformTypeCheckErrors(errors, (error) =>
    fastDeepEqual(nodePath, error.path.slice(0, nodePath.length))
      ? { ...error, path: error.path.slice(nodePath.length) }
      : null
  )
}
