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
  isObservableMap,
  isObservableObject,
  isObservableSet,
  observable,
  observe,
} from "mobx"
import { getCurrentActionContext } from "../action/context"
import { getModelInfoForObject } from "../model/modelInfo"
import { ParentPath } from "../parent"
import { getInternalSnapshot, setInternalSnapshot } from "../snapshot/internal"
import { setParent } from "../parent/setParent"
import { getActionProtection } from "../action/protection"
import { isTweakedObject, tweakedObjects } from "./core"
import { failure } from "../utils"

export function tweak<T>(value: T, parentPath: ParentPath<any> | undefined): T {
  if (typeof value !== "object" || value === null) {
    return value
  }

  // unsupported
  if (value instanceof Map || isObservableMap(value)) {
    throw failure("maps are not supported")
  }

  if (value instanceof Set || isObservableSet(value)) {
    throw failure("sets are not supported")
  }

  if (isTweakedObject(value)) {
    setParent(value, parentPath)
    return value
  }

  const modelInfo = getModelInfoForObject(value)
  if (modelInfo) {
    tweakedObjects.add(value)
    setParent(value, parentPath)

    // nothing to do for models, data is already proxified and its parent is set
    // for snapshots we will use its "data" object snapshot directly

    return value
  }

  // make sure if is an observable first (if not a model)
  if (!isObservable(value)) {
    value = observable(value)
  }

  if (isObservableArray(value)) {
    tweakedObjects.add(value)
    setParent(value, parentPath)

    const standardSn: any[] = []
    const pureJsonSn: any[] = []

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
        pureJsonSn.push(valueSn.pureJson)
      } else {
        // must be a primitive
        standardSn.push(tweakedValue)
        pureJsonSn.push(tweakedValue)
      }
    }

    setInternalSnapshot(value, standardSn, pureJsonSn)

    intercept(value, interceptArrayMutation.bind(undefined, value))
    observe(value, arrayDidChange)

    return value
  }

  // plain object
  if (isObservableObject(value)) {
    tweakedObjects.add(value)
    setParent(value, parentPath)

    const standardSn: any = {}
    const pureJsonSn: any = {}

    // substitute initial values by tweaked values
    for (const [k, v] of entries(value)) {
      const tweakedValue = tweak(v, { parent: value, path: k })
      if (v !== tweakedValue) {
        ;(value as any)[k] = tweakedValue
      }

      const valueSn = getInternalSnapshot(tweakedValue)
      if (valueSn) {
        standardSn[k] = valueSn.standard
        pureJsonSn[k] = valueSn.pureJson
      } else {
        // must be a primitive
        standardSn[k] = tweakedValue
        pureJsonSn[k] = tweakedValue
      }
    }

    setInternalSnapshot(value, standardSn, pureJsonSn)

    intercept(value, interceptObjectMutation)
    observe(value, objectDidChange)

    return value
  }

  throw failure(
    `proxify can only work over models, observable objects/arrays, or primitives, but got ${value} instead`
  )
}

function objectDidChange(change: IObjectDidChange): void {
  let { standard: standardSn, pureJson: pureJsonSn } = getInternalSnapshot(change.object)!

  standardSn = produce(standardSn, (draftStandard: any) => {
    pureJsonSn = produce(pureJsonSn, (draftPureJson: any) => {
      switch (change.type) {
        case "add":
          {
            const k = change.name
            const val = change.newValue
            const valueSn = getInternalSnapshot(val)
            if (valueSn) {
              draftStandard[k] = valueSn.standard
              draftPureJson[k] = valueSn.pureJson
            } else {
              // must be a primitive
              draftStandard[k] = val
              draftPureJson[k] = val
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
              draftPureJson[k] = valueSn.pureJson
            } else {
              // must be a primitive
              draftStandard[k] = val
              draftPureJson[k] = val
            }
          }
          break

        case "remove":
          {
            const k = change.name
            delete draftStandard[k]
            delete draftPureJson[k]
          }
          break
      }
    })
  })

  setInternalSnapshot(change.object, standardSn, pureJsonSn)
}

function interceptObjectMutation(change: IObjectWillChange) {
  assertCanWrite()

  switch (change.type) {
    case "add":
      {
        change.newValue = tweak(change.newValue, { parent: change.object, path: change.name })
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
        change.newValue = tweak(change.newValue, { parent: change.object, path: change.name })
      }
      break
  }

  return change
}

function arrayDidChange(change: IArrayChange | IArraySplice) {
  let { standard: standardSn, pureJson: pureJsonSn } = getInternalSnapshot(change.object)!

  standardSn = produce(standardSn, (draftStandard: any[]) => {
    pureJsonSn = produce(pureJsonSn, (draftPureJson: any[]) => {
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

            const addedPureJsonSn = addedSn.map(([valueSn, val]) =>
              valueSn ? valueSn.pureJson : val
            )
            draftPureJson.splice(change.index, change.removedCount, ...addedPureJsonSn)
          }
          break

        case "update":
          {
            const k = change.index
            const val = change.newValue
            const valueSn = getInternalSnapshot(val)
            if (valueSn) {
              draftStandard[k] = valueSn.standard
              draftPureJson[k] = valueSn.pureJson
            } else {
              // must be a primitive
              draftStandard[k] = val
              draftPureJson[k] = val
            }
          }
          break
      }
    })
  })

  setInternalSnapshot(change.object, standardSn, pureJsonSn)
}

const undefinedInsideArrayErrorMsg =
  "undefined is not supported inside arrays since it is not serializable in JSON, consider using null instead"

function interceptArrayMutation(
  array: IObservableArray,
  change: IArrayWillChange | IArrayWillSplice
) {
  assertCanWrite()

  // TODO: remove array and just use change.object once mobx update event is fixed
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

        tweak(change.object[change.index], undefined) // set old prop obj parent to undefined
        // TODO: should be change.object, but mobx is bugged and doesn't send the proxy
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
