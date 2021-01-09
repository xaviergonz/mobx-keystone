import { getRootPath } from "../parent/path"
import { Path } from "../parent/pathTypes"
import { isTweakedObject } from "../tweaker/core"
import { failure, isNonEmptyArray } from "../utils"
import { drawTree, Tree } from "../utils/drawTree"
import { ReadonlyNonEmptyArray } from "../utils/types"

/**
 * Type check errors.
 */
export type TypeCheckErrors = TypeCheckError | TypeCheckErrorExpression

/**
 * A type check error.
 */
export interface TypeCheckError {
  /**
   * Sub-path where the error occurred.
   */
  readonly path: Path

  /**
   * Name of the expected type.
   */
  readonly expectedTypeName: string

  /**
   * Actual value.
   */
  readonly actualValue: unknown
}

/**
 * A type check error expression.
 */
export interface TypeCheckErrorExpression {
  /**
   * Expression operator.
   */
  readonly op: "and" | "or"

  /**
   * Expression operator arguments.
   */
  readonly args: ReadonlyArray<TypeCheckErrors>
}

/**
 * Creates a new type check error.
 *
 * @param path Sub-path where the error occurred.
 * @param expectedTypeName Name of the expected type.
 * @param actualValue Actual value.
 * @returns The type check error.
 */
export function createTypeCheckError(
  path: Path,
  expectedTypeName: string,
  actualValue: any
): TypeCheckError {
  return { path, expectedTypeName, actualValue }
}

/**
 * Checks whether `errors` is an error expression.
 *
 * @param errors Type check errors.
 * @returns `true` if `errors` is an error expression, otherwise `false`.
 */
export function isTypeCheckErrorExpression(
  errors: TypeCheckErrors
): errors is TypeCheckErrorExpression {
  return hasOwnProperty(errors, "op")
}

/**
 * Merges type check errors by creating a logical expression.
 *
 * @param op Type check expression operator used for merging errors.
 * @param errors Type check errors to merge.
 * @returns The merged type check errors.
 */
export function mergeTypeCheckErrors(
  op: TypeCheckErrorExpression["op"],
  errors: ReadonlyNonEmptyArray<TypeCheckErrors>
): TypeCheckErrors {
  if (errors.length === 1) {
    return errors[0]
  }

  const args: TypeCheckErrors[] = []
  for (const error of errors) {
    if (isTypeCheckErrorExpression(error) && error.op === op) {
      args.push(...error.args)
    } else {
      args.push(error)
    }
  }

  return { op, args }
}

/**
 * Type check error transformer function.
 */
export type TypeCheckErrorTransformer = (error: TypeCheckError) => TypeCheckError | null

/**
 * Transforms type check errors. If `transform` returns `null`, the type check error is omitted.
 *
 * @param errors Type check errors.
 * @param transform Function that transforms a type check error.
 * @returns The new type check errors.
 */
export function transformTypeCheckErrors(
  errors: TypeCheckErrors,
  transform: TypeCheckErrorTransformer
): TypeCheckErrors | null {
  if (isTypeCheckErrorExpression(errors)) {
    const newArgs: TypeCheckErrors[] = []
    for (const arg of errors.args) {
      const newArg = transformTypeCheckErrors(arg, transform)
      if (newArg) {
        newArgs.push(newArg)
      }
    }
    return isNonEmptyArray(newArgs) ? mergeTypeCheckErrors(errors.op, newArgs) : null
  }

  return transform(errors)
}

/**
 * Throws the type check errors as an actual error.
 *
 * @param errors The type check errors.
 * @param value Usually the value where the type check was invoked.
 */
export function throwTypeCheckErrors(errors: TypeCheckErrors, value: unknown): never {
  const msg = getTypeCheckErrorMessage(errors, value)
  throw failure("TypeCheckError:" + (msg.includes("\n") ? "\n" : " ") + msg)
}

/**
 * Gets the error message of type check errors.
 *
 * @param errors The type check errors.
 * @param value Usually the value where the type check was invoked.
 * @returns The error message.
 */
export function getTypeCheckErrorMessage(errors: TypeCheckErrors, value: unknown): string {
  return drawTree(toTree(errors, value))
}

/**
 * @internal
 *
 * Converts type check errors to an error tree representation.
 *
 * @param errors The type check errors.
 * @param value Usually the value where the type check was invoked.
 * @returns The error tree.
 */
function toTree(errors: TypeCheckErrors, value: unknown): Tree<string> {
  if (isTypeCheckErrorExpression(errors)) {
    return {
      value: errors.op.toUpperCase(),
      forest: errors.args.map((arg) => toTree(arg, value)),
    }
  }

  let msg = ""
  let rootPath: Path = []
  if (isTweakedObject(value, true)) {
    rootPath = getRootPath(value).path
  }
  msg += "[/" + [...rootPath, ...errors.path].join("/") + "] "
  msg += "Expected: " + errors.expectedTypeName
  return { value: msg, forest: [] }
}

/**
 * @ignore
 */
function hasOwnProperty<K extends keyof any>(value: unknown, key: K): value is Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}
