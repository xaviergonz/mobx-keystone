import { observable, set } from "mobx"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { isPlainObject } from "../utils"
import {
  FromSnapshotContext,
  internalFromSnapshot,
  observableOptions,
  registerSnapshotter,
} from "./fromSnapshot"
import { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function fromPlainObjectSnapshot(sn: SnapshotInOfObject<any>, ctx: FromSnapshotContext): object {
  const plainObj = observable.object({}, undefined, observableOptions)

  const snKeys = Object.keys(sn)
  const snKeysLen = snKeys.length
  for (let i = 0; i < snKeysLen; i++) {
    const k = snKeys[i]
    const v = sn[k]
    set(plainObj, k, internalFromSnapshot(v, ctx))
  }
  return tweakPlainObject(plainObj, undefined, undefined, true, false)
}

registerSnapshotter(SnapshotterAndReconcilerPriority.PlainObject, (sn, ctx) => {
  if (isPlainObject(sn)) {
    return fromPlainObjectSnapshot(sn, ctx)
  }
  return undefined
})
