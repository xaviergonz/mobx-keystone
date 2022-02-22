import {
  intercept,
  IObjectDidChange,
  IObjectWillChange,
  isObservableObject,
  observable,
  observe,
  set,
} from "mobx"
import { assertCanWrite } from "../action/protection"
import type { AnyModel } from "../model/BaseModel"
import { modelTypeKey } from "../model/metadata"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { dataToModelNode } from "../parent/core"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { getInternalSnapshot, setInternalSnapshot, SnapshotTransformFn } from "../snapshot/internal"
import { failure, isPlainObject, isPrimitive } from "../utils"
import { runningWithoutSnapshotOrPatches, tweakedObjects } from "./core"
import { registerTweaker, tryUntweak, tweak } from "./tweak"
import { TweakerPriority } from "./TweakerPriority"
import { runTypeCheckingAfterChange } from "./typeChecking"

/**
 * @internal
 */
export function tweakPlainObject<T>(
  value: T,
  parentPath: ParentPath<any> | undefined,
  snapshotModelType: string | undefined,
  doNotTweakChildren: boolean,
  isDataObject: boolean
): T {
  const originalObj: { [k: string]: any } = value
  const tweakedObj = isObservableObject(originalObj)
    ? originalObj
    : observable.object({}, undefined, observableOptions)

  let interceptDisposer: () => void
  let observeDisposer: () => void

  const untweak = () => {
    interceptDisposer()
    observeDisposer()
  }

  tweakedObjects.set(tweakedObj, untweak)
  setParent({
    value: tweakedObj,
    parentPath,
    indexChangeAllowed: false,
    isDataObject,
    // an object shouldn't be cloned
    cloneIfApplicable: false,
  })

  let untransformedSn: any = {}

  // substitute initial values by tweaked values
  const originalObjKeys = Object.keys(originalObj)
  const originalObjKeysLen = originalObjKeys.length
  for (let i = 0; i < originalObjKeysLen; i++) {
    const k = originalObjKeys[i]
    const v = originalObj[k]

    if (isPrimitive(v)) {
      if (!doNotTweakChildren) {
        set(tweakedObj, k, v)
      }
      untransformedSn[k] = v
    } else {
      const path = { parent: tweakedObj, path: k }

      let tweakedValue
      if (doNotTweakChildren) {
        tweakedValue = v
        setParent({
          value: tweakedValue,
          parentPath: path,
          indexChangeAllowed: false,
          isDataObject: false,
          // the value is already a new value (the result of a fromSnapshot)
          cloneIfApplicable: false,
        })
      } else {
        tweakedValue = tweak(v, path)
        set(tweakedObj, k, tweakedValue)
      }

      const valueSn = getInternalSnapshot(tweakedValue)!
      untransformedSn[k] = valueSn.transformed
    }
  }

  let transformFn: SnapshotTransformFn | undefined
  if (snapshotModelType) {
    untransformedSn[modelTypeKey] = snapshotModelType

    const modelInfo = getModelInfoForName(snapshotModelType)
    if (!modelInfo) {
      throw failure(`model with name "${snapshotModelType}" not found in the registry`)
    }

    const originalTransformFn = (modelInfo.class as ModelClass<AnyModel>).toSnapshotProcessor
    if (originalTransformFn) {
      transformFn = (sn) => originalTransformFn(sn, dataToModelNode(tweakedObj))
    }
  }

  setInternalSnapshot(
    isDataObject ? dataToModelNode(tweakedObj) : tweakedObj,
    untransformedSn,
    transformFn
  )

  interceptDisposer = intercept(tweakedObj, interceptObjectMutation)
  observeDisposer = observe(tweakedObj, objectDidChange)

  return tweakedObj as any
}

const observableOptions = {
  deep: false,
}

function objectDidChange(change: IObjectDidChange): void {
  const obj = change.object
  const actualNode = dataToModelNode(obj)
  let { untransformed: untransformedSn } = getInternalSnapshot(actualNode)!

  const patchRecorder = new InternalPatchRecorder()

  untransformedSn = Object.assign({}, untransformedSn)

  switch (change.type) {
    case "add":
    case "update":
      {
        const k = change.name
        const val = change.newValue
        const oldVal = untransformedSn[k]
        if (isPrimitive(val)) {
          untransformedSn[k] = val
        } else {
          const valueSn = getInternalSnapshot(val)!
          untransformedSn[k] = valueSn.transformed
        }

        const path = [k as string]
        if (change.type === "add") {
          patchRecorder.record(
            [
              {
                op: "add",
                path,
                value: untransformedSn[k],
              },
            ],
            [
              {
                op: "remove",
                path,
              },
            ]
          )
        } else {
          patchRecorder.record(
            [
              {
                op: "replace",
                path,
                value: untransformedSn[k],
              },
            ],
            [
              {
                op: "replace",
                path,
                value: oldVal,
              },
            ]
          )
        }
      }
      break

    case "remove":
      {
        const k = change.name
        const oldVal = untransformedSn[k]
        delete untransformedSn[k]

        const path = [k as string]

        patchRecorder.record(
          [
            {
              op: "remove",
              path,
            },
          ],
          [
            {
              op: "add",
              path,
              value: oldVal,
            },
          ]
        )
      }
      break
  }

  runTypeCheckingAfterChange(obj, patchRecorder)

  if (!runningWithoutSnapshotOrPatches) {
    setInternalSnapshot(actualNode, untransformedSn, undefined)
    patchRecorder.emit(actualNode)
  }
}

function interceptObjectMutation(change: IObjectWillChange) {
  assertCanWrite()

  if (typeof change.name === "symbol") {
    throw failure("symbol properties are not supported")
  }

  switch (change.type) {
    case "add":
      change.newValue = tweak(change.newValue, {
        parent: change.object,
        path: "" + change.name,
      })
      break

    case "remove": {
      const oldVal = change.object[change.name]
      tweak(oldVal, undefined)
      tryUntweak(oldVal)
      break
    }

    case "update": {
      const oldVal = change.object[change.name]
      tweak(oldVal, undefined)
      tryUntweak(oldVal)

      change.newValue = tweak(change.newValue, {
        parent: change.object,
        path: "" + change.name,
      })
      break
    }
  }

  return change
}

registerTweaker(TweakerPriority.PlainObject, (value, parentPath) => {
  // plain object
  if (isObservableObject(value) || isPlainObject(value)) {
    return tweakPlainObject(value, parentPath, undefined, false, false)
  }
  return undefined
})
