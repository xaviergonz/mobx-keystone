import { produce } from "immer"
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
import { getCurrentActionContext } from "../action/context"
import { getActionProtection } from "../action/protection"
import { Frozen, frozenKey } from "../frozen/Frozen"
import { ModelMetadata, modelMetadataKey } from "../model/metadata"
import { getModelInfoForObject } from "../model/modelInfo"
import { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { getInternalSnapshot, setInternalSnapshot } from "../snapshot/internal"
import { failure, isMap, isObject, isPlainObject, isPrimitive, isSet } from "../utils"
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
function internalTweak<T>(
  value: T,
  parentPath: ParentPath<any> | undefined,
  snapshotModelMetadata?: ModelMetadata
): T {
  if (isPrimitive(value)) {
    return value
  }

  if (isTweakedObject(value)) {
    setParent(value, parentPath)
    return value
  }

  // unsupported
  if (isMap(value)) {
    throw failure("maps are not supported")
  }

  // unsupported
  if (isSet(value)) {
    throw failure("sets are not supported")
  }

  if ((value as any) instanceof Frozen) {
    const frozenObj = value as Frozen<any>
    tweakedObjects.add(frozenObj)
    setParent(frozenObj, parentPath)

    // we DON'T want data proxified, but the snapshot is the data itself
    setInternalSnapshot(frozenObj, { [frozenKey]: true, data: frozenObj.data }, undefined)

    return frozenObj as any
  }

  const modelInfo = getModelInfoForObject(value)
  if (modelInfo) {
    tweakedObjects.add(value)
    setParent(value, parentPath)

    // nothing to do for models, data is already proxified and its parent is set
    // for snapshots we will use its "data" object snapshot directly

    return value
  }

  if (Array.isArray(value) || isObservableArray(value)) {
    const originalArr: ReadonlyArray<any> = value
    const arrLn = originalArr.length
    const tweakedArr = isObservableArray(originalArr) ? originalArr : observable.array()
    if (tweakedArr !== originalArr) {
      tweakedArr.length = originalArr.length
    }

    tweakedObjects.add(tweakedArr)
    setParent(tweakedArr, parentPath)

    const standardSn: any[] = []
    standardSn.length = arrLn

    // substitute initial values by proxied values
    for (let i = 0; i < arrLn; i++) {
      const currentValue = originalArr[i]
      const tweakedValue = tweak(currentValue, { parent: tweakedArr, path: "" + i })
      set(tweakedArr, i, tweakedValue)

      const valueSn = getInternalSnapshot(tweakedValue)
      if (valueSn) {
        standardSn[i] = valueSn.standard
      } else {
        // must be a primitive
        standardSn[i] = tweakedValue
      }
    }

    setInternalSnapshot(tweakedArr, standardSn, undefined)

    intercept(tweakedArr, interceptArrayMutation.bind(undefined, tweakedArr))
    observe(tweakedArr, arrayDidChange)

    return tweakedArr as any
  }

  // plain object
  if (isObservableObject(value) || isPlainObject(value)) {
    const originalObj: { [k: string]: any } = value
    const tweakedObj = isObservableObject(originalObj) ? originalObj : observable.object({})

    tweakedObjects.add(tweakedObj)
    setParent(tweakedObj, parentPath)

    const standardSn: any = {}

    // substitute initial values by tweaked values
    const originalObjKeys = Object.keys(originalObj)
    const originalObjKeysLen = originalObjKeys.length
    for (let i = 0; i < originalObjKeysLen; i++) {
      const k = originalObjKeys[i]
      const v = originalObj[k]

      const tweakedValue = tweak(v, { parent: tweakedObj, path: k })
      set(tweakedObj, k, tweakedValue)

      const valueSn = getInternalSnapshot(tweakedValue)
      if (valueSn) {
        standardSn[k] = valueSn.standard
      } else {
        // must be a primitive
        standardSn[k] = tweakedValue
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

  throw failure(
    `tweak can only work over models, observable objects/arrays, or primitives, but got ${value} instead`
  )
}

/***
 * @ignore
 */
export const tweak = action("tweak", internalTweak)

function objectDidChange(change: IObjectDidChange): void {
  let { standard: standardSn } = getInternalSnapshot(change.object)!

  const patchRecorder = new InternalPatchRecorder()

  standardSn = produce(
    standardSn,
    (draftStandard: any) => {
      switch (change.type) {
        case "add":
          {
            const k = change.name
            const val = change.newValue
            const valueSn = getInternalSnapshot(val)
            if (valueSn) {
              draftStandard[k] = valueSn.standard
            } else {
              // must be a primitive
              draftStandard[k] = val
            }
          }
          break

        case "update":
          {
            const k = change.name
            const val = change.newValue
            const valueSn = getInternalSnapshot(val)
            if (valueSn) {
              draftStandard[k] = valueSn.standard
            } else {
              // must be a primitive
              draftStandard[k] = val
            }
          }
          break

        case "remove":
          {
            const k = change.name
            delete draftStandard[k]
          }
          break
      }
    },
    patchRecorder.record
  )

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

  standardSn = produce(
    standardSn,
    (draftStandard: any[]) => {
      switch (change.type) {
        case "splice":
          {
            const addedSn = change.added.map(val => {
              const valueSn = getInternalSnapshot(val)
              return [valueSn, val]
            })

            const addedStandardSn = addedSn.map(([valueSn, val]) =>
              valueSn ? valueSn.standard : val
            )
            draftStandard.splice(change.index, change.removedCount, ...addedStandardSn)
          }
          break

        case "update":
          {
            const k = change.index
            const val = change.newValue
            const valueSn = getInternalSnapshot(val)
            if (valueSn) {
              draftStandard[k] = valueSn.standard
            } else {
              // must be a primitive
              draftStandard[k] = val
            }
          }
          break
      }
    },
    patchRecorder.record
  )

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
        change.added.forEach(v => {
          if (v === undefined) {
            throw failure(undefinedInsideArrayErrorMsg)
          }
        })

        change.object
          .slice(change.index, change.index + change.removedCount)
          .forEach(removedValue => {
            tweak(removedValue, undefined)
          })
        change.added = change.added.map((newValue, addedIndex) =>
          tweak(newValue, { parent: change.object, path: "" + (change.index + addedIndex) })
        )
      }
      break

    case "update":
      {
        if (change.newValue === undefined) {
          throw failure(undefinedInsideArrayErrorMsg)
        }

        // TODO: should be change.object, but mobx is bugged and doesn't send the proxy
        tweak(array[change.index], undefined) // set old prop obj parent to undefined
        change.newValue = tweak(change.newValue, { parent: array, path: "" + change.index })
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
