import { observable } from "mobx"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { isPlainObject, setProtoProp } from "../utils"
import { getCurrentErrorDiagnosticsContext } from "../utils/errorDiagnostics"
import {
  type FromSnapshotContext,
  internalFromSnapshot,
  observableOptions,
  registerSnapshotter,
} from "./fromSnapshot"
import type { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function fromPlainObjectSnapshot(sn: SnapshotInOfObject<any>, ctx: FromSnapshotContext): object {
  const plainObj: Record<string, unknown> = {}
  // Hydration visits every property. Keep this direct stack use rather than
  // withErrorPathSegment: it avoids one callback closure per property and has
  // a measured production hydration win.
  const errorDiagnosticsContext = getCurrentErrorDiagnosticsContext()

  const snKeys = Object.keys(sn)
  const snKeysLen = snKeys.length
  for (let i = 0; i < snKeysLen; i++) {
    const k = snKeys[i]
    const v = sn[k]
    errorDiagnosticsContext?.pushPath(k)
    let snapshotValue: unknown
    try {
      snapshotValue = internalFromSnapshot(v, ctx)
    } finally {
      errorDiagnosticsContext?.popPath()
    }
    if (k === "__proto__") {
      setProtoProp(plainObj, snapshotValue)
    } else {
      plainObj[k] = snapshotValue
    }
  }
  return tweakPlainObject(
    observable.object(plainObj, undefined, observableOptions),
    undefined,
    undefined,
    true,
    false
  )
}

/**
 * @internal
 */
export function registerFromPlainObjectSnapshotter() {
  registerSnapshotter(SnapshotterAndReconcilerPriority.PlainObject, (sn, ctx) => {
    if (isPlainObject(sn)) {
      return fromPlainObjectSnapshot(sn, ctx)
    }
    return undefined
  })
}
