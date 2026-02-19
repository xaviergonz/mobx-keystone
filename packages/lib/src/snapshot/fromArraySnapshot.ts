import { observable } from "mobx"
import { tweakArray } from "../tweaker/tweakArray"
import { isArray } from "../utils"
import { withErrorPathSegment } from "../utils/errorDiagnostics"
import {
  FromSnapshotContext,
  internalFromSnapshot,
  observableOptions,
  registerSnapshotter,
} from "./fromSnapshot"
import { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function fromArraySnapshot(sn: SnapshotInOfObject<any>, ctx: FromSnapshotContext): any[] {
  const arr = observable.array([] as any[], observableOptions)
  const ln = sn.length
  for (let i = 0; i < ln; i++) {
    arr.push(withErrorPathSegment(i, () => internalFromSnapshot(sn[i], ctx)))
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
