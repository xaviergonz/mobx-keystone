import { getRootPath } from "../parent/path"
import { isTweakedObject } from "../tweaker/core"
import { failure } from "../utils"

/**
 * A type checking error.
 */
export class TypeCheckError {
  /**
   * Creates an instance of TypeError.
   * @param path Sub-path where the error occured.
   * @param expectedTypeName Name of the expected type.
   * @param actualValue Actual value.
   */
  constructor(
    readonly path: ReadonlyArray<string | number>,
    readonly expectedTypeName: string,
    readonly actualValue: any
  ) {}

  /**
   * Throws the type check error as an actual error.
   *
   * @param typeCheckedValue Usually the value where the type check was invoked.
   */
  throw(typeCheckedValue: any): never {
    let msg = "TypeCheckError: "
    let rootPath: ReadonlyArray<string | number> = []
    if (typeCheckedValue && isTweakedObject(typeCheckedValue)) {
      rootPath = getRootPath(typeCheckedValue).path
    }

    msg += "[" + [...rootPath, ...this.path].join("/") + "] "

    msg += "Expected: " + this.expectedTypeName

    throw failure(msg)
  }
}
