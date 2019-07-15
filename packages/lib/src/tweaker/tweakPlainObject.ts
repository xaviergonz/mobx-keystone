import {
  intercept,
  IObjectDidChange,
  IObjectWillChange,
  isObservableObject,
  observable,
  observe,
  set,
} from "mobx"
import { ModelMetadata, modelMetadataKey } from "../model/metadata"
import { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { getInternalSnapshot, setInternalSnapshot } from "../snapshot/internal"
import { failure, isPrimitive } from "../utils"
import { assertCanWrite, runningWithoutSnapshotOrPatches, tweakedObjects } from "./core"
import { tweak } from "./tweak"
import { runTypeCheckingAfterChange } from "./typeChecking"

/**
 * @ignore
 */
export function tweakPlainObject<T>(
  value: T,
  parentPath: ParentPath<any> | undefined,
  snapshotModelMetadata: ModelMetadata | undefined,
  doNotTweakChildren: boolean
): T {
  const originalObj: { [k: string]: any } = value
  const tweakedObj = isObservableObject(originalObj)
    ? originalObj
    : observable.object({}, undefined, observableOptions)

  tweakedObjects.add(tweakedObj)
  setParent(tweakedObj, parentPath)

  const standardSn: any = {}

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
      standardSn[k] = v
    } else {
      const path = { parent: tweakedObj, path: k }

      let tweakedValue
      if (doNotTweakChildren) {
        tweakedValue = v
        setParent(tweakedValue, path)
      } else {
        tweakedValue = tweak(v, path)
        set(tweakedObj, k, tweakedValue)
      }

      const valueSn = getInternalSnapshot(tweakedValue)!
      standardSn[k] = valueSn.standard
    }
  }

  if (snapshotModelMetadata) {
    standardSn[modelMetadataKey] = snapshotModelMetadata
  }

  setInternalSnapshot(tweakedObj, standardSn)

  intercept(tweakedObj, interceptObjectMutation)
  observe(tweakedObj, objectDidChange)

  return tweakedObj as any
}

const observableOptions = {
  deep: false,
}

function objectDidChange(change: IObjectDidChange): void {
  const obj = change.object
  let { standard: standardSn } = getInternalSnapshot(obj)!

  const patchRecorder = new InternalPatchRecorder()

  standardSn = Object.assign({}, standardSn)

  switch (change.type) {
    case "add":
    case "update":
      {
        const k = change.name
        const val = change.newValue
        const oldVal = standardSn[k]
        if (isPrimitive(val)) {
          standardSn[k] = val
        } else {
          const valueSn = getInternalSnapshot(val)!
          standardSn[k] = valueSn.standard
        }

        const path = [k as string]
        if (change.type === "add") {
          patchRecorder.record(
            [
              {
                op: "add",
                path,
                value: standardSn[k],
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
                value: standardSn[k],
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
        const oldVal = standardSn[k]
        delete standardSn[k]

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
    setInternalSnapshot(obj, standardSn)
    patchRecorder.emit(obj)
  }
}

function interceptObjectMutation(change: IObjectWillChange) {
  assertCanWrite()

  if (typeof change.name === "symbol") {
    throw failure("symbol properties are not supported.")
  }

  switch (change.type) {
    case "add":
      {
        change.newValue = tweak(change.newValue, {
          parent: change.object,
          path: "" + (change.name as any),
        })
      }
      break
    case "remove":
      {
        tweak(change.object[change.name], undefined)
      }
      break
    case "update":
      {
        tweak(change.object[change.name], undefined)
        change.newValue = tweak(change.newValue, {
          parent: change.object,
          path: "" + (change.name as any),
        })
      }
      break
  }

  return change
}
