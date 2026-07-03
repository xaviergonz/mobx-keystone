import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { isPlainObject, setOwnProp } from "../utils"
import { withErrorPathSegment } from "../utils/errorDiagnostics"
import { type FromSnapshotContext, internalFromSnapshot, registerSnapshotter } from "./fromSnapshot"
import type { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function fromPlainObjectSnapshot(sn: SnapshotInOfObject<any>, ctx: FromSnapshotContext): object {
  const plainObj: Record<string, unknown> = {}

  const snKeys = Object.keys(sn)
  const snKeysLen = snKeys.length
  for (let i = 0; i < snKeysLen; i++) {
    const k = snKeys[i]
    const v = sn[k]
    setOwnProp(
      plainObj,
      k,
      withErrorPathSegment(k, () => internalFromSnapshot(v, ctx))
    )
  }
  return tweakPlainObject(plainObj, undefined, undefined, true, false, true)
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
