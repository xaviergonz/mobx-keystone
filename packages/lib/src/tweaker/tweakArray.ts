import {
  IArrayWillChange,
  IArrayWillSplice,
  intercept,
  IObservableArray,
  isObservableArray,
  observable,
  observe,
  set,
} from "mobx"
import { assertCanWrite } from "../action/protection"
import { getGlobalConfig } from "../globalConfig"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { InternalPatchRecorder } from "../patch/emitPatch"
import type { Patch } from "../patch/Patch"
import { getInternalSnapshot, setInternalSnapshot } from "../snapshot/internal"
import { failure, inDevMode, isArray, isPrimitive } from "../utils"
import { runningWithoutSnapshotOrPatches, tweakedObjects } from "./core"
import { registerTweaker, tryUntweak, tweak } from "./tweak"
import { TweakerPriority } from "./TweakerPriority"
import { runTypeCheckingAfterChange } from "./typeChecking"

/**
 * @ignore
 */
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

  let interceptDisposer: () => void
  let observeDisposer: () => void

  const untweak = () => {
    interceptDisposer()
    observeDisposer()
  }

  tweakedObjects.set(tweakedArr, untweak)
  setParent({
    value: tweakedArr,
    parentPath,
    indexChangeAllowed: false,
    isDataObject: false,
    // arrays shouldn't be cloned anyway
    cloneIfApplicable: false,
  })

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
        set(tweakedArr, i, tweakedValue)
      }

      const valueSn = getInternalSnapshot(tweakedValue)!
      standardSn[i] = valueSn.standard
    }
  }

  setInternalSnapshot(tweakedArr, standardSn)

  interceptDisposer = intercept(tweakedArr, interceptArrayMutation.bind(undefined, tweakedArr))
  observeDisposer = observe(tweakedArr, arrayDidChange)

  return tweakedArr as any
}

function arrayDidChange(change: any /*IArrayDidChange*/) {
  const arr = change.object
  let { standard: oldSnapshot } = getInternalSnapshot(arr as Array<any>)!

  const patchRecorder = new InternalPatchRecorder()

  const newSnapshot = oldSnapshot.slice()

  switch (change.type) {
    case "splice":
      {
        const index = change.index
        const addedCount = change.addedCount
        const removedCount = change.removedCount

        let addedItems = []
        addedItems.length = addedCount
        for (let i = 0; i < addedCount; i++) {
          const v = change.added[i]
          if (isPrimitive(v)) {
            addedItems[i] = v
          } else {
            addedItems[i] = getInternalSnapshot(v)!.standard
          }
        }

        const oldLen = oldSnapshot.length
        newSnapshot.splice(index, removedCount, ...addedItems)

        const patches: Patch[] = []
        const invPatches: Patch[] = []

        // optimization: if we add as many as we remove then replace instead
        if (addedCount === removedCount) {
          for (let i = 0; i < addedCount; i++) {
            const realIndex = index + i

            const newVal = newSnapshot[realIndex]
            const oldVal = oldSnapshot[realIndex]

            if (newVal !== oldVal) {
              const path = [realIndex]
              // replace 0, 1, 2...
              patches.push({
                op: "replace",
                path,
                value: newVal,
              })
              // replace ...2, 1, 0 since inverse patches are applied in reverse
              invPatches.push({
                op: "replace",
                path,
                value: oldVal,
              })
            }
          }
        } else {
          const interimLen = oldLen - removedCount

          // first remove items
          if (removedCount > 0) {
            // optimization, when removing from the end set the length instead
            const removeUsingSetLength = index >= interimLen
            if (removeUsingSetLength) {
              patches.push({
                op: "replace",
                path: ["length"],
                value: interimLen,
              })
            }

            for (let i = removedCount - 1; i >= 0; i--) {
              const realIndex = index + i
              const path = [realIndex]

              if (!removeUsingSetLength) {
                // remove ...2, 1, 0
                patches.push({
                  op: "remove",
                  path,
                })
              }

              // add 0, 1, 2... since inverse patches are applied in reverse
              invPatches.push({
                op: "add",
                path,
                value: oldSnapshot[realIndex],
              })
            }
          }

          // then add items
          if (addedCount > 0) {
            // optimization, for inverse patches, when adding from the end set the length to restore instead
            const restoreUsingSetLength = index >= interimLen
            if (restoreUsingSetLength) {
              invPatches.push({
                op: "replace",
                path: ["length"],
                value: interimLen,
              })
            }

            for (let i = 0; i < addedCount; i++) {
              const realIndex = index + i
              const path = [realIndex]

              // add 0, 1, 2...
              patches.push({
                op: "add",
                path,
                value: newSnapshot[realIndex],
              })

              // remove ...2, 1, 0 since inverse patches are applied in reverse
              if (!restoreUsingSetLength) {
                invPatches.push({
                  op: "remove",
                  path,
                })
              }
            }
          }
        }

        patchRecorder.record(patches, invPatches)
      }
      break

    case "update":
      {
        const k = change.index
        const val = change.newValue
        const oldVal = newSnapshot[k]
        if (isPrimitive(val)) {
          newSnapshot[k] = val
        } else {
          const valueSn = getInternalSnapshot(val)!
          newSnapshot[k] = valueSn.standard
        }

        const path = [k]

        patchRecorder.record(
          [
            {
              op: "replace",
              path,
              value: newSnapshot[k],
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

  runTypeCheckingAfterChange(arr, patchRecorder)

  if (!runningWithoutSnapshotOrPatches) {
    setInternalSnapshot(arr, newSnapshot)
    patchRecorder.emit(arr)
  }
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
        if (inDevMode() && !getGlobalConfig().allowUndefinedArrayElements) {
          const len = change.added.length
          for (let i = 0; i < len; i++) {
            const v = change.added[i]
            if (v === undefined) {
              throw failure(undefinedInsideArrayErrorMsg)
            }
          }
        }

        for (let i = 0; i < change.removedCount; i++) {
          const removedValue = change.object[change.index + i]
          tweak(removedValue, undefined)
          tryUntweak(removedValue)
        }

        for (let i = 0; i < change.added.length; i++) {
          change.added[i] = tweak(change.added[i], {
            parent: change.object,
            path: change.index + i,
          })
        }

        // we might also need to update the parent of the next indexes
        const oldNextIndex = change.index + change.removedCount
        const newNextIndex = change.index + change.added.length

        if (oldNextIndex !== newNextIndex) {
          for (let i = oldNextIndex, j = newNextIndex; i < change.object.length; i++, j++) {
            setParent({
              value: change.object[i],
              parentPath: {
                parent: change.object,
                path: j,
              },
              indexChangeAllowed: true,
              isDataObject: false,
              // just re-indexing
              cloneIfApplicable: false,
            })
          }
        }
      }
      break

    case "update":
      if (
        inDevMode() &&
        !getGlobalConfig().allowUndefinedArrayElements &&
        change.newValue === undefined
      ) {
        throw failure(undefinedInsideArrayErrorMsg)
      }

      // TODO: should be change.object, but mobx is bugged and doesn't send the proxy
      const oldVal = array[change.index]
      tweak(oldVal, undefined) // set old prop obj parent to undefined
      tryUntweak(oldVal)

      change.newValue = tweak(change.newValue, { parent: array, path: change.index })
      break
  }
  return change
}

registerTweaker(TweakerPriority.Array, (value, parentPath) => {
  if (isArray(value)) {
    return tweakArray(value, parentPath, false)
  }
  return undefined
})

const observableOptions = {
  deep: false,
}
