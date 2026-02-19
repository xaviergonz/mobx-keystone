import { Path } from "../parent/pathTypes"
import { MobxKeystoneError } from "../utils"
import {
  buildErrorMessageWithDiagnostics,
  getErrorModelTrailSnapshot,
  getErrorPathSnapshot,
  noErrorValuePreview,
} from "../utils/errorDiagnostics"

export interface SnapshotProcessingErrorData {
  message: string
  path?: Path
  actualSnapshot?: any
  modelTrail?: readonly string[]
}

/**
 * Thrown when a structural issue is encountered while processing a snapshot (extends `MobxKeystoneError`).
 *
 * Use `instanceof SnapshotProcessingError` to distinguish snapshot processing errors
 * from other `MobxKeystoneError` instances.
 */
export class SnapshotProcessingError extends MobxKeystoneError {
  readonly path: Path
  readonly actualSnapshot?: any
  readonly modelTrail?: readonly string[]

  constructor(data: SnapshotProcessingErrorData) {
    const path = data.path ?? getErrorPathSnapshot() ?? []
    const modelTrail = data.modelTrail ?? getErrorModelTrailSnapshot()

    super(
      buildErrorMessageWithDiagnostics({
        message: data.message,
        path,
        previewValue: "actualSnapshot" in data ? data.actualSnapshot : noErrorValuePreview,
        modelTrail,
      })
    )

    this.path = path
    this.actualSnapshot = data.actualSnapshot
    this.modelTrail = modelTrail
  }
}
