import {
  IArrayChange,
  IArraySplice,
  IArrayWillChange,
  IArrayWillSplice,
  intercept,
  IObservableArray,
  isObservableArray,
  observable,
  observe,
  set,
} from "mobx"
import { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { InternalPatchRecorder } from "../patch/emitPatch"
import { Patch } from "../patch/Patch"
import { getInternalSnapshot, setInternalSnapshot } from "../snapshot/internal"
import { failure, inDevMode, isPrimitive } from "../utils"
import { assertCanWrite, runningWithoutSnapshotOrPatches, tweakedObjects } from "./core"
import { tryUntweak, tweak } from "./tweak"
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
  setParent(tweakedArr, parentPath, false, false)

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
        setParent(tweakedValue, path, false, false)
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

function arrayDidChange(change: IArrayChange | IArraySplice) {
  const arr = change.object
  let { standard: standardSn } = getInternalSnapshot(arr)!

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

  runTypeCheckingAfterChange(arr, patchRecorder)

  if (!runningWithoutSnapshotOrPatches) {
    setInternalSnapshot(arr, standardSn)
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
        if (inDevMode()) {
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
            setParent(
              change.object[i],
              {
                parent: change.object,
                path: j,
              },
              true,
              false
            )
          }
        }
      }
      break

    case "update":
      if (inDevMode() && change.newValue === undefined) {
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

const observableOptions = {
  deep: false,
}
