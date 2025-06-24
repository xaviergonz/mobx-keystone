import {
  intercept,
  IObjectDidChange,
  IObjectWillChange,
  isObservableObject,
  observable,
  observe,
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
import {
  freezeInternalSnapshot,
  getInternalSnapshot,
  setNewInternalSnapshot,
  SnapshotTransformFn,
  updateInternalSnapshot,
} from "../snapshot/internal"
import { failure, isPlainObject, isPrimitive } from "../utils"
import { setIfDifferent } from "../utils/setIfDifferent"
import { runningWithoutSnapshotOrPatches, tweakedObjects } from "./core"
import { registerTweaker, tweak } from "./tweak"
import { TweakerPriority } from "./TweakerPriority"
import { runTypeCheckingAfterChange } from "./typeChecking"

/**
 * @internal
 */
export function tweakPlainObject<T extends Record<string, any>>(
  value: T,
  parentPath: ParentPath<any> | undefined,
  snapshotModelType: string | undefined,
  doNotTweakChildren: boolean,
  isDataObject: boolean
): T {
  const originalObj: Record<string, any> = value
  const tweakedObj = isObservableObject(originalObj)
    ? originalObj
    : observable.object({}, undefined, observableOptions)

  // biome-ignore lint/style/useConst: intended
  let interceptDisposer: () => void
  // biome-ignore lint/style/useConst: intended
  let observeDisposer: () => void

  const untweak = () => {
    interceptDisposer()
    observeDisposer()
  }

  tweakedObjects.set(tweakedObj, untweak)
  setParent(
    tweakedObj, // value
    parentPath,
    false, // indexChangeAllowed
    isDataObject,
    // an object shouldn't be cloned
    false // cloneIfApplicable
  )

  const untransformedSn: any = {}

  // substitute initial values by tweaked values
  const originalObjKeys = Object.keys(originalObj)
  const originalObjKeysLen = originalObjKeys.length
  for (let i = 0; i < originalObjKeysLen; i++) {
    const k = originalObjKeys[i]
    const v = originalObj[k]

    if (isPrimitive(v)) {
      if (!doNotTweakChildren) {
        setIfDifferent(tweakedObj, k, v)
      }
      untransformedSn[k] = v
    } else {
      const path = { parent: tweakedObj, path: k }

      let tweakedValue: any
      if (doNotTweakChildren) {
        tweakedValue = v
        setParent(
          tweakedValue, // value
          path, // parentPath
          false, // indexChangeAllowed
          false, // isDataObject
          // the value is already a new value (the result of a fromSnapshot)
          false // cloneIfApplicable
        )
      } else {
        tweakedValue = tweak(v, path)
        setIfDifferent(tweakedObj, k, tweakedValue)
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

  setNewInternalSnapshot(
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

function mutateSet(k: PropertyKey, v: unknown, sn: Record<PropertyKey, unknown>) {
  sn[k] = v
}

function mutateDelete(k: PropertyKey, sn: Record<PropertyKey, unknown>) {
  delete sn[k]
}

const patchRecorder = new InternalPatchRecorder()

function objectDidChange(change: IObjectDidChange): void {
  const obj = change.object
  const actualNode = dataToModelNode(obj)
  const oldUntransformedSn = getInternalSnapshot(actualNode)!.untransformed

  patchRecorder.reset()

  let mutate: ((sn: any) => void) | undefined

  switch (change.type) {
    case "add":
    case "update":
      mutate = objectDidChangeAddOrUpdate(change, oldUntransformedSn)
      break

    case "remove":
      mutate = objectDidChangeRemove(change, oldUntransformedSn)
      break

    default:
      throw failure("assertion error: unsupported object change type")
  }

  runTypeCheckingAfterChange(obj, patchRecorder)

  if (!runningWithoutSnapshotOrPatches) {
    updateInternalSnapshot(actualNode, mutate)
    patchRecorder.emit(actualNode)
  }
}

function objectDidChangeRemove(
  change: IObjectDidChange & { type: "remove" },
  oldUntransformedSn: any
) {
  const k = change.name
  const oldVal = oldUntransformedSn[k]
  const mutate = mutateDelete.bind(undefined, k)

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
        value: freezeInternalSnapshot(oldVal),
      },
    ]
  )
  return mutate
}

function objectDidChangeAddOrUpdate(
  change: IObjectWillChange & { type: "add" | "update" },
  oldUntransformedSn: any
) {
  const k = change.name
  const val = change.newValue

  const oldVal = oldUntransformedSn[k]

  let newVal: any
  if (isPrimitive(val)) {
    newVal = val
  } else {
    const valueSn = getInternalSnapshot(val)!
    newVal = valueSn.transformed
  }

  const mutate = mutateSet.bind(undefined, k, newVal)

  const path = [k as string]
  if (change.type === "add") {
    patchRecorder.record(
      [
        {
          op: "add",
          path,
          value: freezeInternalSnapshot(newVal),
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
          value: freezeInternalSnapshot(newVal),
        },
      ],
      [
        {
          op: "replace",
          path,
          value: freezeInternalSnapshot(oldVal),
        },
      ]
    )
  }

  return mutate
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
        path: String(change.name),
      })
      break

    case "remove": {
      tweak(change.object[change.name], undefined)
      break
    }

    case "update": {
      const oldVal = change.object[change.name]
      const newVal = change.newValue
      if (newVal !== oldVal) {
        tweak(oldVal, undefined)

        change.newValue = tweak(newVal, {
          parent: change.object,
          path: String(change.name),
        })
      }
      break
    }

    default:
      throw failure("assertion error: unsupported object change type")
  }

  return change
}

/**
 * @internal
 */
export function registerPlainObjectTweaker() {
  registerTweaker(TweakerPriority.PlainObject, (value, parentPath) => {
    // plain object
    if (isObservableObject(value) || isPlainObject(value)) {
      return tweakPlainObject(value as Record<string, any>, parentPath, undefined, false, false)
    }
    return undefined
  })
}
