import { Path } from "../parent/pathTypes"
import { MobxKeystoneError } from "../utils"
import {
  buildErrorMessageWithDiagnostics,
  getErrorModelTrailSnapshot,
  getErrorPathSnapshot,
} from "../utils/errorDiagnostics"

export interface SnapshotTypeMismatchErrorData {
  path?: Path
  expectedTypeName: string
  actualValue: any
  modelTrail?: readonly string[]
}

/**
 * Thrown when a snapshot value does not match any of the expected types in a union (extends `MobxKeystoneError`).
 *
 * Use `instanceof SnapshotTypeMismatchError` to distinguish snapshot type-mismatch errors
 * from other `MobxKeystoneError` instances.
 */
export class SnapshotTypeMismatchError extends MobxKeystoneError {
  readonly path: Path
  readonly expectedTypeName: string
  readonly actualValue: any
  readonly modelTrail?: readonly string[]

  constructor(data: SnapshotTypeMismatchErrorData) {
    const path = data.path ?? getErrorPathSnapshot() ?? []
    const modelTrail = data.modelTrail ?? getErrorModelTrailSnapshot()

    super(
      buildErrorMessageWithDiagnostics({
        message: `snapshot does not match the following type: <${data.expectedTypeName}>`,
        path,
        previewValue: data.actualValue,
        modelTrail,
      })
    )

    this.path = path
    this.expectedTypeName = data.expectedTypeName
    this.actualValue = data.actualValue
    this.modelTrail = modelTrail
  }
}
