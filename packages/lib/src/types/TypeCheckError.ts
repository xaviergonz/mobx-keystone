import { fastGetRootPath } from "../parent/path"
import { Path } from "../parent/pathTypes"
import { getSnapshot } from "../snapshot/getSnapshot"
import { isTweakedObject } from "../tweaker/core"
import { failure } from "../utils"

/**
 * A type checking error.
 */
export class TypeCheckError {
  /**
   * The type check error message.
   */
  readonly message: string

  /**
   * Creates an instance of TypeError.
   * @param path Sub-path (where the root is the value being type checked) where the error occured.
   * @param expectedTypeName Name of the expected type.
   * @param actualValue Actual value.
   * @param typeCheckedValue The value where the type check was invoked.
   */
  constructor(
    readonly path: Path,
    readonly expectedTypeName: string,
    readonly actualValue: any,
    readonly typeCheckedValue?: any
  ) {
    let rootPath: Path = []
    if (this.typeCheckedValue && isTweakedObject(this.typeCheckedValue, true)) {
      rootPath = fastGetRootPath(this.typeCheckedValue).path
    }

    const actualValueSnapshot = isTweakedObject(this.actualValue, true)
      ? getSnapshot(this.actualValue)
      : this.actualValue

    this.message = `TypeCheckError: [/${[...rootPath, ...this.path].join(
      "/"
    )}] Expected a value of type <${this.expectedTypeName}> but got the value <${JSON.stringify(
      actualValueSnapshot
    )}> instead`
  }

  /**
   * Throws the type check error as an actual error.
   */
  throw(): never {
    throw failure(this.message)
  }
}
