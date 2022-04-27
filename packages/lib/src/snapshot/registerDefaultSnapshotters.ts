import { registerFromArraySnapshotter } from "./fromArraySnapshot"
import { registerFromFrozenSnapshotter } from "./fromFrozenSnapshot"
import { registerFromModelSnapshotter } from "./fromModelSnapshot"
import { registerFromPlainObjectSnapshotter } from "./fromPlainObjectSnapshot"

let defaultSnapshottersRegistered = false

/**
 * @internal
 */
export function registerDefaultSnapshotters() {
  if (defaultSnapshottersRegistered) {
    return
  }
  defaultSnapshottersRegistered = true

  registerFromArraySnapshotter()
  registerFromFrozenSnapshotter()
  registerFromModelSnapshotter()
  registerFromPlainObjectSnapshotter()
}
