import { getRootPath } from "../parent/path"
import { isTweakedObject } from "../tweaker/core"
import { failure } from "../utils"

/**
 * A type checking error.
 */
export class TypeCheckError {
  /**
   * Creates an instance of TypeError.
   * @param path Path where the error occured.
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
   */
  throw(root: object): never {
    let msg = "TypeCheckError: "
    let rootPath: ReadonlyArray<string | number> = []
    if (root && isTweakedObject(root)) {
      rootPath = getRootPath(root).path
    }

    msg += "[" + [...rootPath, ...this.path].join("/") + "] "

    msg += "Expected: " + this.expectedTypeName

    throw failure(msg)
  }
}
