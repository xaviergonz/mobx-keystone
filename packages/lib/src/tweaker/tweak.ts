import { produce } from "immer"
import {
  entries,
  IArrayChange,
  IArraySplice,
  IArrayWillChange,
  IArrayWillSplice,
  intercept,
  IObjectDidChange,
  IObjectWillChange,
  IObservableArray,
  isObservable,
  isObservableArray,
  isObservableObject,
  observable,
  observe,
} from "mobx"
import { getCurrentActionContext } from "../action/context"
import { getActionProtection } from "../action/protection"
import { Frozen, frozenKey } from "../frozen/Frozen"
import { getModelInfoForObject } from "../model/modelInfo"
import { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { getInternalSnapshot, setInternalSnapshot } from "../snapshot/internal"
import { failure, isMap, isObject, isPrimitive, isSet } from "../utils"
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
export function tweak<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  if (isPrimitive(value)) {
    return value
  }

  // unsupported
  if (isMap(value)) {
    throw failure("maps are not supported")
  }

  if (isSet(value)) {
    throw failure("sets are not supported")
  }

  if (isTweakedObject(value)) {
    setParent(value, parentPath)
    return value
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

  // make sure it is an observable first (if not a model)
  if (!isObservable(value)) {
    value = observable(value)
  }

  if (isObservableArray(value)) {
    tweakedObjects.add(value)
    setParent(value, parentPath)

    const standardSn: any[] = []

    // substitute initial values by proxied values
    const arr = value as IObservableArray
    for (let i = 0; i < arr.length; i++) {
      const currentValue = arr[i]
      const tweakedValue = tweak(currentValue, { parent: arr, path: "" + i })
      if (currentValue !== tweakedValue) {
        arr[i] = tweakedValue
      }

      const valueSn = getInternalSnapshot(tweakedValue)
      if (valueSn) {
        standardSn.push(valueSn.standard)
      } else {
        // must be a primitive
        standardSn.push(tweakedValue)
      }
    }

    setInternalSnapshot(value, standardSn, undefined)

    intercept(value, interceptArrayMutation.bind(undefined, value))
    observe(value, arrayDidChange)

    return value
  }

  // plain object
  if (isObservableObject(value)) {
    tweakedObjects.add(value)
    setParent(value, parentPath)

    const standardSn: any = {}

    // substitute initial values by tweaked values
    for (const [k, v] of entries(value)) {
      const tweakedValue = tweak(v, { parent: value, path: k })
      if (v !== tweakedValue) {
        ;(value as any)[k] = tweakedValue
      }

      const valueSn = getInternalSnapshot(tweakedValue)
      if (valueSn) {
        standardSn[k] = valueSn.standard
      } else {
        // must be a primitive
        standardSn[k] = tweakedValue
      }
    }

    setInternalSnapshot(value, standardSn, undefined)

    intercept(value, interceptObjectMutation)
    observe(value, objectDidChange)

    return value
  }

  throw failure(
    `tweak can only work over models, observable objects/arrays, or primitives, but got ${value} instead`
  )
}

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
