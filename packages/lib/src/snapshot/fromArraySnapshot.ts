import { tweakArray } from "../tweaker/tweakArray"
import { isArray } from "../utils"
import { getCurrentErrorDiagnosticsContext } from "../utils/errorDiagnostics"
import { type FromSnapshotContext, internalFromSnapshot, registerSnapshotter } from "./fromSnapshot"
import type { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function fromArraySnapshot(sn: SnapshotInOfObject<any>, ctx: FromSnapshotContext): any[] {
  const ln = sn.length
  const arr: any[] = new Array(ln)
  // Hydration visits every slot. Keep this direct stack use rather than
  // withErrorPathSegment: it avoids one callback closure per item and has a
  // measured production hydration win.
  const errorDiagnosticsContext = getCurrentErrorDiagnosticsContext()
  for (let i = 0; i < ln; i++) {
    errorDiagnosticsContext?.pushPath(i)
    try {
      arr[i] = internalFromSnapshot(sn[i], ctx)
    } finally {
      errorDiagnosticsContext?.popPath()
    }
  }
  return tweakArray(arr, undefined, true)
}

/**
 * @internal
 */
export function registerFromArraySnapshotter() {
  registerSnapshotter(SnapshotterAndReconcilerPriority.Array, (sn, ctx) => {
    if (isArray(sn)) {
      return fromArraySnapshot(sn, ctx)
    }
    return undefined
  })
}
