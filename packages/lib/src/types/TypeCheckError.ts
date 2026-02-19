import { fastGetRootPath } from "../parent/path"
import { Path } from "../parent/pathTypes"
import { getSnapshot } from "../snapshot/getSnapshot"
import { isTweakedObject } from "../tweaker/core"
import { MobxKeystoneError } from "../utils"
import {
  buildErrorMessageWithDiagnostics,
  getErrorModelTrailSnapshot,
  getErrorPathSnapshot,
} from "../utils/errorDiagnostics"

export interface TypeCheckErrorData {
  path: Path
  expectedTypeName: string
  actualValue: any
  typeCheckedValue?: any
  modelTrail?: readonly string[]
}

/**
 * A type checking error.
 */
export class TypeCheckError {
  readonly message: string
  readonly path: Path
  readonly expectedTypeName: string
  readonly actualValue: any
  readonly typeCheckedValue?: any
  readonly modelTrail?: readonly string[]

  /**
   * Creates a type check error from an object payload.
   * @param data Type check error data.
   */

  constructor(data: TypeCheckErrorData)
  /**
   * @deprecated Use the object payload constructor instead for better readability and maintainability.
   *
   * Creates a type check error from positional parameters.
   * @param path Sub-path (where the root is the value being type checked) where the error occurred.
   * @param expectedTypeName Name of the expected type.
   * @param actualValue Actual value.
   * @param typeCheckedValue The value where the type check was invoked.
   */
  constructor(path: Path, expectedTypeName: string, actualValue: any, typeCheckedValue?: any)

  constructor(
    dataOrPath: TypeCheckErrorData | Path,
    expectedTypeName?: string,
    actualValue?: any,
    typeCheckedValue?: any
  ) {
    const data = normalizeTypeCheckErrorData(
      dataOrPath,
      expectedTypeName,
      actualValue,
      typeCheckedValue
    )
    const resolvedData = resolveTypeCheckErrorData(data)

    this.path = data.path
    this.expectedTypeName = data.expectedTypeName
    this.actualValue = data.actualValue
    this.typeCheckedValue = data.typeCheckedValue
    this.modelTrail = resolvedData.modelTrail
    this.message = resolvedData.message
  }

  /**
   * Throws the type check error as an actual error.
   */
  throw(): never {
    const diagnosticsPath = getErrorPathSnapshot()
    const path =
      diagnosticsPath && diagnosticsPath.length > 0 ? [...diagnosticsPath, ...this.path] : this.path

    throw new TypeCheckErrorFailure({
      path,
      expectedTypeName: this.expectedTypeName,
      actualValue: this.actualValue,
      typeCheckedValue: this.typeCheckedValue,
      modelTrail: this.modelTrail,
    })
  }
}

/**
 * A thrown type-check failure (extends `MobxKeystoneError`).
 *
 * Thrown by {@link TypeCheckError.throw} when a runtime type check fails.
 * Use `instanceof TypeCheckErrorFailure` to distinguish type-check errors
 * from other `MobxKeystoneError` instances.
 */
export class TypeCheckErrorFailure extends MobxKeystoneError {
  readonly path: Path
  readonly expectedTypeName: string
  readonly actualValue: any
  readonly typeCheckedValue?: any
  readonly modelTrail?: readonly string[]

  constructor(data: TypeCheckErrorData) {
    const resolvedData = resolveTypeCheckErrorData(data)

    super(resolvedData.message)

    this.path = resolvedData.fullPath
    this.expectedTypeName = data.expectedTypeName
    this.actualValue = data.actualValue
    this.typeCheckedValue = data.typeCheckedValue
    this.modelTrail = resolvedData.modelTrail
  }
}

function normalizeTypeCheckErrorData(
  dataOrPath: TypeCheckErrorData | Path,
  expectedTypeName?: string,
  actualValue?: any,
  typeCheckedValue?: any
): TypeCheckErrorData {
  if (isTypeCheckErrorData(dataOrPath)) {
    return dataOrPath
  }

  return {
    path: dataOrPath,
    expectedTypeName: expectedTypeName!,
    actualValue,
    typeCheckedValue,
  }
}

function isTypeCheckErrorData(value: unknown): value is TypeCheckErrorData {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "expectedTypeName" in value
  )
}

function resolveTypeCheckErrorData(data: TypeCheckErrorData): {
  fullPath: Path
  modelTrail?: readonly string[]
  message: string
} {
  const modelTrail = data.modelTrail ?? getErrorModelTrailSnapshot()
  const fullPath = resolveFullPath(data.path, data.typeCheckedValue)
  const actualValueSnapshot = isTweakedObject(data.actualValue, true)
    ? getSnapshot(data.actualValue)
    : data.actualValue

  return {
    fullPath,
    modelTrail,
    message: buildErrorMessageWithDiagnostics({
      message: `TypeCheckError: Expected a value of type <${data.expectedTypeName}> but got an incompatible value`,
      path: fullPath,
      previewValue: actualValueSnapshot,
      modelTrail,
    }),
  }
}

function resolveFullPath(path: Path, typeCheckedValue: any): Path {
  let rootPath: Path = []
  if (typeCheckedValue && isTweakedObject(typeCheckedValue, true)) {
    rootPath = fastGetRootPath(typeCheckedValue, false).path
  }
  return rootPath.length > 0 && !pathStartsWith(path, rootPath) ? [...rootPath, ...path] : path
}

function pathStartsWith(path: Path, prefix: Path): boolean {
  if (prefix.length > path.length) {
    return false
  }

  for (let i = 0; i < prefix.length; i++) {
    if (path[i] !== prefix[i]) {
      return false
    }
  }
  return true
}
