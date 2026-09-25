import { isObservableObject, remove } from "mobx"
import { isModel } from "../model/utils"
import {
  isTypeCheckingAfterChangeEnabled,
  runTypeCheckingAfterChange,
} from "../tweaker/typeChecking"
import { withoutTypeChecking } from "../tweaker/withoutTypeChecking"
import { hasOwnProp, isPlainObject } from "../utils"
import { withErrorPathSegment } from "../utils/errorDiagnostics"
import type { ModelPool } from "../utils/ModelPool"
import { setIfDifferent } from "../utils/setIfDifferent"
import { fromSnapshot } from "./fromSnapshot"
import { getSnapshot } from "./getSnapshot"
import { detachIfNeeded, reconcileSnapshot, registerReconciler } from "./reconcileSnapshot"
import type { SnapshotInOfObject } from "./SnapshotOf"
import { SnapshotterAndReconcilerPriority } from "./SnapshotterAndReconcilerPriority"

function reconcilePlainObjectSnapshot(
  value: any,
  sn: SnapshotInOfObject<any>,
  modelPool: ModelPool
): object {
  // Observable models carry instance state and must be replaced, not edited as plain objects.
  if (isModel(value) || !(isPlainObject(value) || isObservableObject(value))) {
    // no reconciliation possible
    return fromSnapshot(sn)
  }

  const plainObj = value
  const typeCheckingAfterChangeEnabled = isTypeCheckingAfterChangeEnabled()
  const snapshotBeforeChanges = typeCheckingAfterChangeEnabled ? getSnapshot(plainObj) : undefined

  withoutTypeChecking(() => {
    // remove excess props
    const plainObjKeys = Object.keys(plainObj)
    const plainObjKeysLen = plainObjKeys.length
    for (let i = 0; i < plainObjKeysLen; i++) {
      const k = plainObjKeys[i]
      if (!hasOwnProp(sn, k)) {
        remove(plainObj, k)
      }
    }

    // reconcile the rest
    const snKeys = Object.keys(sn)
    const snKeysLen = snKeys.length
    for (let i = 0; i < snKeysLen; i++) {
      const k = snKeys[i]
      const v = sn[k]

      // an inherited member such as `toString` is no old value (but `__proto__`
      // still reads the prototype, which is rejected as it is no tree node)
      const oldValue = k === "__proto__" || hasOwnProp(plainObj, k) ? plainObj[k] : undefined
      const newValue = withErrorPathSegment(k, () =>
        reconcileSnapshot(oldValue, v, modelPool, plainObj)
      )

      detachIfNeeded(newValue, oldValue, modelPool)

      setIfDifferent(plainObj, k, newValue)
    }
  })

  if (typeCheckingAfterChangeEnabled) {
    runTypeCheckingAfterChange(plainObj, undefined, snapshotBeforeChanges)
  }

  return plainObj
}

/**
 * @internal
 */
export function registerPlainObjectSnapshotReconciler() {
  registerReconciler(SnapshotterAndReconcilerPriority.PlainObject, (value, sn, modelPool) => {
    if (isPlainObject(sn)) {
      return reconcilePlainObjectSnapshot(value, sn, modelPool)
    }
    return undefined
  })
}
