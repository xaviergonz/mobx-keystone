import {
  action,
  IArrayChange,
  IArraySplice,
  IArrayWillChange,
  IArrayWillSplice,
  intercept,
  IObjectDidChange,
  IObjectWillChange,
  IObservableArray,
  isObservableArray,
  isObservableObject,
  observable,
  observe,
  set,
} from "mobx"
import { Patch } from ".."
import { getCurrentActionContext } from "../action/context"
import { getActionProtection } from "../action/protection"
import { Frozen, frozenKey } from "../frozen/Frozen"
import { ModelMetadata, modelMetadataKey } from "../model/metadata"
import { getModelInfoForObject } from "../model/modelInfo"
import { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { getInternalSnapshot, setInternalSnapshot } from "../snapshot/internal"
import { failure, inDevMode, isMap, isObject, isPlainObject, isPrimitive, isSet } from "../utils"
import { isTreeNode, isTweakedObject, tweakedObjects } from "./core"

/**
 * Turns an object (array, plain object) into a tree node,
 * which then can accept calls to `getParent`, `getSnapshot`, etc.
 * If a tree node is passed it will return the passed argument directly.
 *
 * @param value Object to turn into a tree node.
 * @returns The object as a tree node.
 */
export function toTreeNode<T extends object>(value: T): T {
  if (!isObject(value)) {
    throw failure("only objects can be turned into tree nodes")
  }

  if (!isTreeNode(value)) {
    return tweak(value, undefined)
  }
  return value
}

/**
 * @ignore
 */
function internalTweak<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  if (isPrimitive(value)) {
    return value
  }

  if (isTweakedObject(value)) {
    setParent(value, parentPath)
    return value
  }

  if ((value as any) instanceof Frozen) {
    return tweakFrozen(value, parentPath)
  }

  const modelInfo = getModelInfoForObject(value)
  if (modelInfo) {
    return tweakModel(value, parentPath)
  }

  if (Array.isArray(value) || isObservableArray(value)) {
    return tweakArray(value, parentPath, false)
  }

  // plain object
  if (isObservableObject(value) || isPlainObject(value)) {
    return tweakPlainObject(value, parentPath, undefined, false)
  }

  // unsupported
  if (isMap(value)) {
    throw failure("maps are not supported")
  }

  // unsupported
  if (isSet(value)) {
    throw failure("sets are not supported")
  }

  throw failure(
    `tweak can only work over models, observable objects/arrays, or primitives, but got ${value} instead`
  )
}

export function tweakFrozen<T extends Frozen<any>>(
  frozenObj: T,
  parentPath: ParentPath<any> | undefined
): T {
  tweakedObjects.add(frozenObj)
  setParent(frozenObj, parentPath)

  // we DON'T want data proxified, but the snapshot is the data itself
  setInternalSnapshot(frozenObj, { [frozenKey]: true, data: frozenObj.data }, undefined)

  return frozenObj as any
}

export function tweakModel<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  tweakedObjects.add(value)
  setParent(value, parentPath)

  // nothing to do for models, data is already proxified and its parent is set
  // for snapshots we will use its "data" object snapshot directly

  return value
}

export function tweakArray<T extends any[]>(
  value: T,
  parentPath: ParentPath<any> | undefined,
  doNotTweakChildren: boolean
): T {
  const originalArr: ReadonlyArray<any> = value
  const arrLn = originalArr.length
  const tweakedArr = isObservableArray(originalArr)
    ? originalArr
    : observable.array([], observableOptions)
  if (tweakedArr !== originalArr) {
    tweakedArr.length = originalArr.length
  }

  tweakedObjects.add(tweakedArr)
  setParent(tweakedArr, parentPath)

  const standardSn: any[] = []
  standardSn.length = arrLn

  // substitute initial values by proxied values
  for (let i = 0; i < arrLn; i++) {
    const v = originalArr[i]

    if (isPrimitive(v)) {
      if (!doNotTweakChildren) {
        set(tweakedArr, i, v)
      }

      standardSn[i] = v
    } else {
      const path = { parent: tweakedArr, path: i }

      let tweakedValue
      if (doNotTweakChildren) {
        tweakedValue = v
        setParent(tweakedValue, path)
      } else {
        tweakedValue = tweak(v, path)
        set(tweakedArr, i, tweakedValue)
      }

      const valueSn = getInternalSnapshot(tweakedValue)!
      standardSn[i] = valueSn.standard
    }
  }

  setInternalSnapshot(tweakedArr, standardSn, undefined)

  intercept(tweakedArr, interceptArrayMutation.bind(undefined, tweakedArr))
  observe(tweakedArr, arrayDidChange)

  return tweakedArr as any
}

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

  setInternalSnapshot(tweakedObj, standardSn, undefined)

  intercept(tweakedObj, interceptObjectMutation)
  observe(tweakedObj, objectDidChange)

  return tweakedObj as any
}

/**
 * @ignore
 */
export const tweak = action("tweak", internalTweak)

function objectDidChange(change: IObjectDidChange): void {
  let { standard: standardSn } = getInternalSnapshot(change.object)!

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

  setInternalSnapshot(change.object, standardSn, patchRecorder)
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

function arrayDidChange(change: IArrayChange | IArraySplice) {
  let { standard: standardSn } = getInternalSnapshot(change.object)!

  const patchRecorder = new InternalPatchRecorder()

  standardSn = standardSn.slice()

  switch (change.type) {
    case "splice":
      {
        let addedItems = []
        const addedCount = change.addedCount
        addedItems.length = addedCount
        for (let i = 0; i < addedCount; i++) {
          const v = change.added[i]
          if (isPrimitive(v)) {
            addedItems[i] = v
          } else {
            addedItems[i] = getInternalSnapshot(v)!.standard
          }
        }

        const oldLen = standardSn.length
        const removedCount = change.removedCount
        const removedItems = standardSn.splice(change.index, removedCount, ...addedItems)

        // generate patches
        const patches: Patch[] = []
        const invPatches: Patch[] = []

        const replacedCount = Math.min(removedCount, addedCount)
        for (let i = 0; i < replacedCount; i++) {
          const oldVal = removedItems[i]
          const newVal = addedItems[i]
          if (oldVal !== newVal) {
            const path = [change.index + i]
            patches.push({
              op: "replace",
              path,
              value: newVal,
            })
            invPatches.push({
              op: "replace",
              path,
              value: oldVal,
            })
          }
        }

        if (removedCount > addedCount) {
          patches.push({
            op: "replace",
            path: ["length"],
            value: standardSn.length,
          })

          for (let i = replacedCount; i < removedCount; i++) {
            const path = [change.index + i]
            invPatches.push({
              op: "add",
              path,
              value: removedItems[i],
            })
          }
        } else if (addedCount > removedCount) {
          for (let i = replacedCount; i < addedCount; i++) {
            const path = [change.index + i]
            patches.push({
              op: "add",
              path,
              value: addedItems[i],
            })
          }

          invPatches.push({
            op: "replace",
            path: ["length"],
            value: oldLen,
          })
        }

        patchRecorder.record(patches, invPatches)
      }
      break

    case "update":
      {
        const k = change.index
        const val = change.newValue
        const oldVal = standardSn[k]
        if (isPrimitive(val)) {
          standardSn[k] = val
        } else {
          const valueSn = getInternalSnapshot(val)!
          standardSn[k] = valueSn.standard
        }

        const path = [k]

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
      break
  }

  setInternalSnapshot(change.object, standardSn, patchRecorder)
}

const undefinedInsideArrayErrorMsg =
  "undefined is not supported inside arrays since it is not serializable in JSON, consider using null instead"

// TODO: remove array parameter and just use change.object once mobx update event is fixed
function interceptArrayMutation(
  array: IObservableArray,
  change: IArrayWillChange | IArrayWillSplice
) {
  assertCanWrite()

  switch (change.type) {
    case "splice":
      {
        if (inDevMode()) {
          change.added.forEach(v => {
            if (v === undefined) {
              throw failure(undefinedInsideArrayErrorMsg)
            }
          })
        }

        for (let i = 0; i < change.removedCount; i++) {
          const removedValue = change.object[change.index + i]
          tweak(removedValue, undefined)
        }

        for (let i = 0; i < change.added.length; i++) {
          change.added[i] = tweak(change.added[i], {
            parent: change.object,
            path: change.index + i,
          })
        }
      }
      break

    case "update":
      {
        if (inDevMode() && change.newValue === undefined) {
          throw failure(undefinedInsideArrayErrorMsg)
        }

        // TODO: should be change.object, but mobx is bugged and doesn't send the proxy
        tweak(array[change.index], undefined) // set old prop obj parent to undefined
        change.newValue = tweak(change.newValue, { parent: array, path: change.index })
      }
      break
  }
  return change
}

function canWrite(): boolean {
  return !getActionProtection() || !!getCurrentActionContext()
}

function assertCanWrite() {
  if (!canWrite()) {
    throw failure("data changes must be performed inside model actions")
  }
}

const observableOptions = {
  deep: false,
}
