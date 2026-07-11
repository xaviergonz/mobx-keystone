import {
  type IArrayDidChange,
  type IArrayWillChange,
  type IArrayWillSplice,
  type IObservableArray,
  intercept,
  isObservableArray,
  observable,
  observe,
} from "mobx"
import { assertCanWrite } from "../action/protection"
import { emitArraySpliceDeepChange, emitArrayUpdateDeepChange } from "../deepChange/onDeepChange"
import { getGlobalConfig } from "../globalConfig"
import type { ParentPath } from "../parent/path"
import { setParent } from "../parent/setParent"
import { hasPatchListenersFor, InternalPatchRecorder } from "../patch/emitPatch"
import type { Patch } from "../patch/Patch"
import {
  freezeInternalSnapshot,
  getInternalSnapshot,
  setNewInternalSnapshot,
  updateInternalSnapshot,
} from "../snapshot/internal"
import { failure, inDevMode, isArray, isPrimitive } from "../utils"
import { runningWithoutSnapshotOrPatches, setTweakedObjectUntweakers, tweakedObjects } from "./core"
import { TweakerPriority } from "./TweakerPriority"
import { registerTweaker, tweak } from "./tweak"
import { isTypeCheckingAfterChangeEnabled, runTypeCheckingAfterChange } from "./typeChecking"

/**
 * @internal
 */
export function tweakArray<T extends any[]>(
  value: T,
  parentPath: ParentPath<any> | undefined,
  childrenAlreadyTweaked: boolean
): T {
  const originalArr: ReadonlyArray<any> = value
  const arrLn = originalArr.length
  const originalArrIsObservable = isObservableArray(originalArr)
  let tweakedArr: IObservableArray<any>
  // Fresh arrays whose children still need tweaking are collected into a plain
  // buffer and inserted in one bulk replace at the end.
  let buffer: any[] | undefined

  if (originalArrIsObservable) {
    tweakedArr = originalArr as IObservableArray<any>
  } else if (childrenAlreadyTweaked) {
    // Snapshot arrays already contain tweaked children, so MobX can initialize
    // the observable array directly from the source values.
    tweakedArr = observable.array(originalArr as any[], observableOptions)
  } else {
    tweakedArr = observable.array(undefined, observableOptions)
    buffer = new Array(arrLn)
  }

  // Mark it as tweaked before processing children. The cleanup functions are
  // installed after the MobX handlers have been registered.
  tweakedObjects.set(tweakedArr, undefined)
  setParent(
    tweakedArr, // value
    parentPath,
    false, // indexChangeAllowed
    false, // isDataObject
    // arrays shouldn't be cloned anyway
    false // cloneIfApplicable
  )

  const untransformedSn: any[] = []
  untransformedSn.length = arrLn

  // Only externally supplied observable arrays need replacement ranges. Fresh
  // arrays use the bulk buffer path, while snapshot arrays are already populated.
  const replacementQueue =
    !buffer && !childrenAlreadyTweaked ? new ObservableArrayReplacementQueue(tweakedArr) : undefined

  // substitute initial values by proxied values
  for (let i = 0; i < arrLn; i++) {
    const v = originalArr[i]

    if (isPrimitive(v)) {
      if (buffer) {
        buffer[i] = v
      } else if (!childrenAlreadyTweaked) {
        replacementQueue!.queueIfDifferent(i, v)
      }

      untransformedSn[i] = v
    } else {
      const path = { parent: tweakedArr, path: i }

      let tweakedValue: any
      if (childrenAlreadyTweaked) {
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
      }

      if (buffer) {
        buffer[i] = tweakedValue
      } else if (!childrenAlreadyTweaked) {
        replacementQueue!.queueIfDifferent(i, tweakedValue)
      }

      const valueSn = getInternalSnapshot(tweakedValue)!
      untransformedSn[i] = valueSn.transformed
    }
  }

  if (buffer) {
    // done before the intercept/observe handlers are installed, so this
    // is a single plain mobx bulk insertion
    tweakedArr.replace(buffer)
  } else {
    replacementQueue?.flush()
  }
  setNewInternalSnapshot(tweakedArr, untransformedSn, undefined)

  const interceptDisposer = intercept(
    tweakedArr,
    interceptArrayMutation.bind(undefined, tweakedArr)
  )
  const observeDisposer = observe(tweakedArr, arrayDidChange)
  setTweakedObjectUntweakers(tweakedArr, interceptDisposer, observeDisposer)

  return tweakedArr as any
}

function mutateSet(k: number, v: unknown, sn: unknown[]) {
  sn[k] = v
}

function mutateSplice(index: number, removedCount: number, addedItems: any[], sn: any[]) {
  sn.splice(index, removedCount, ...addedItems)
}

const patchRecorder = new InternalPatchRecorder()

function arrayDidChange(change: IArrayDidChange) {
  const arr = change.object

  patchRecorder.reset()

  switch (change.type) {
    case "splice":
      emitArraySpliceDeepChange(arr, arr, change.index as number, change.added, change.removed)
      break

    case "update":
      emitArrayUpdateDeepChange(arr, arr, change.index as number, change.newValue, change.oldValue)

      break

    default:
      break
  }

  if (runningWithoutSnapshotOrPatches) {
    return
  }

  const oldSnapshot = getInternalSnapshot(arr as Array<unknown>)!.untransformed
  const shouldEmitPatches = hasPatchListenersFor(arr)
  const shouldBuildInversePatches = shouldEmitPatches || isTypeCheckingAfterChangeEnabled()

  let mutate: ((sn: any[]) => void) | undefined
  switch (change.type) {
    case "splice":
      mutate = arrayDidChangeSplice(
        change,
        oldSnapshot,
        shouldEmitPatches,
        shouldBuildInversePatches
      )
      break
    case "update":
      mutate = arrayDidChangeUpdate(
        change,
        oldSnapshot,
        shouldEmitPatches,
        shouldBuildInversePatches
      )
      break
    default:
      break
  }

  runTypeCheckingAfterChange(arr, patchRecorder)
  if (mutate) {
    updateInternalSnapshot(arr, mutate)
    patchRecorder.emit(arr)
  }
}

const undefinedInsideArrayErrorMsg =
  "undefined is not supported inside arrays since it is not serializable in JSON, consider using null instead"

function arrayDidChangeUpdate(
  change: any /*IArrayDidChange*/,
  oldSnapshot: any,
  shouldEmitPatches: boolean,
  shouldBuildInversePatches: boolean
) {
  const k = change.index
  const val = change.newValue
  const oldVal = oldSnapshot[k]
  let newVal: any
  if (isPrimitive(val)) {
    newVal = val
  } else {
    const valueSn = getInternalSnapshot(val)!
    newVal = valueSn.transformed
  }
  const mutate = mutateSet.bind(undefined, k, newVal)

  if (shouldEmitPatches || shouldBuildInversePatches) {
    const path = [k]
    const patches = shouldEmitPatches
      ? [{ op: "replace" as const, path, value: freezeInternalSnapshot(newVal) }]
      : undefined
    const invPatches = shouldBuildInversePatches
      ? [{ op: "replace" as const, path, value: freezeInternalSnapshot(oldVal) }]
      : undefined
    patchRecorder.record(patches, invPatches)
  }
  return mutate
}

function arrayDidChangeSplice(
  change: any /*IArrayDidChange*/,
  oldSnapshot: any,
  shouldEmitPatches: boolean,
  shouldBuildInversePatches: boolean
) {
  const index = change.index as number
  const addedCount = change.addedCount as number
  const removedCount = change.removedCount as number

  const addedItems: any[] = []
  addedItems.length = addedCount
  for (let i = 0; i < addedCount; i++) {
    const v = change.added[i]
    if (isPrimitive(v)) {
      addedItems[i] = v
    } else {
      addedItems[i] = getInternalSnapshot(v)!.transformed
    }
  }

  const oldLen = oldSnapshot.length
  const mutate = mutateSplice.bind(undefined, index, removedCount, addedItems)

  const patches: Patch[] | undefined = shouldEmitPatches ? [] : undefined
  const invPatches: Patch[] | undefined = shouldBuildInversePatches ? [] : undefined

  // optimization: if we add as many as we remove then remove/readd instead

  // we cannot replace since we might end up in a situation where the same node
  // might attempt to be temporarily twice inside the same tree (e.g. sorting)

  // it would be faster to keep holes rather than remove/readd, but if we do that then
  // validation might fail

  if (addedCount === removedCount) {
    const readdPatches: Patch[] | undefined = shouldEmitPatches ? [] : undefined
    const readdInvPatches: Patch[] | undefined = shouldBuildInversePatches ? [] : undefined
    let removed = 0

    for (let i = 0; i < addedCount; i++) {
      const realIndex = index + i

      const newVal = getValueAfterSplice(oldSnapshot, realIndex, index, removedCount, addedItems)
      const oldVal = oldSnapshot[realIndex]

      if (newVal !== oldVal) {
        const removePath = [realIndex - removed]
        patches?.push({
          op: "remove",
          path: removePath,
        })
        invPatches?.push({
          op: "remove",
          path: removePath,
        })

        removed++

        const readdPath = [realIndex]
        readdPatches?.push({
          op: "add",
          path: readdPath,
          value: freezeInternalSnapshot(newVal),
        })

        readdInvPatches?.push({
          op: "add",
          path: readdPath,
          value: freezeInternalSnapshot(oldVal),
        })
      }
    }

    if (patches && readdPatches && readdPatches.length > 0) {
      patches.push(...readdPatches)
    }
    if (invPatches && readdInvPatches && readdInvPatches.length > 0) {
      invPatches.push(...readdInvPatches)
    }
    // We need to reverse once since inverse patches are applied in reverse.
    // Repeated unshift calls here would make a large splice quadratic.
    if (invPatches && invPatches.length > 0) {
      invPatches.reverse()
    }
  } else {
    const interimLen = oldLen - removedCount

    // first remove items
    if (removedCount > 0) {
      // optimization, when removing from the end set the length instead
      const removeUsingSetLength = index >= interimLen
      if (removeUsingSetLength) {
        patches?.push({
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
          patches?.push({
            op: "remove",
            path,
          })
        }

        // add 0, 1, 2... since inverse patches are applied in reverse
        invPatches?.push({
          op: "add",
          path,
          value: freezeInternalSnapshot(oldSnapshot[realIndex]),
        })
      }
    }

    // then add items
    if (addedCount > 0) {
      // optimization, for inverse patches, when adding from the end set the length to restore instead
      const restoreUsingSetLength = index >= interimLen
      if (restoreUsingSetLength) {
        invPatches?.push({
          op: "replace",
          path: ["length"],
          value: interimLen,
        })
      }

      for (let i = 0; i < addedCount; i++) {
        const realIndex = index + i
        const path = [realIndex]

        // add 0, 1, 2...
        patches?.push({
          op: "add",
          path,
          value: freezeInternalSnapshot(
            getValueAfterSplice(oldSnapshot, realIndex, index, removedCount, addedItems)
          ),
        })

        // remove ...2, 1, 0 since inverse patches are applied in reverse
        if (!restoreUsingSetLength) {
          invPatches?.push({
            op: "remove",
            path,
          })
        }
      }
    }
  }

  if (patches || invPatches) {
    patchRecorder.record(patches, invPatches)
  }
  return mutate
}

// TODO: remove array parameter and just use change.object once mobx update event is fixed
function interceptArrayMutation(
  array: IObservableArray,
  change: IArrayWillChange | IArrayWillSplice
) {
  assertCanWrite()

  switch (change.type) {
    case "splice":
      interceptArrayMutationSplice(change)
      break

    case "update":
      interceptArrayMutationUpdate(change, array)
      break

    default:
      break
  }
  return change
}

function interceptArrayMutationUpdate(change: IArrayWillChange, array: IObservableArray) {
  if (
    inDevMode &&
    !getGlobalConfig().allowUndefinedArrayElements &&
    change.newValue === undefined
  ) {
    throw failure(undefinedInsideArrayErrorMsg)
  }

  // TODO: should be change.object, but mobx is bugged and doesn't send the proxy
  const oldVal = array[change.index]
  tweak(oldVal, undefined) // set old prop obj parent to undefined

  change.newValue = tweak(change.newValue, { parent: array, path: change.index })
}

function interceptArrayMutationSplice(change: IArrayWillSplice) {
  if (inDevMode && !getGlobalConfig().allowUndefinedArrayElements) {
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
        change.object[i], // value
        {
          parent: change.object,
          path: j,
        }, // parentPath
        true, // indexChangeAllowed
        false, // isDataObject
        // just re-indexing
        false // cloneIfApplicable
      )
    }
  }
}

/**
 * @internal
 */
export function registerArrayTweaker() {
  registerTweaker(TweakerPriority.Array, (value, parentPath) => {
    if (isArray(value)) {
      return tweakArray(value, parentPath, false)
    }
    return undefined
  })
}

const observableOptions = {
  deep: false,
}

class ObservableArrayReplacementQueue {
  private readonly array: IObservableArray<any>
  private rangeStart = -1
  private rangeItems: any[] | undefined

  constructor(array: IObservableArray<any>) {
    this.array = array
  }

  queueIfDifferent(index: number, value: unknown): void {
    if (this.array[index] === value && index in this.array) {
      this.flush()
      return
    }

    if (this.rangeStart + (this.rangeItems?.length ?? 0) === index) {
      this.rangeItems!.push(value)
    } else {
      this.flush()
      this.rangeStart = index
      this.rangeItems = [value]
    }
  }

  flush(): void {
    if (this.rangeStart >= 0) {
      this.array.spliceWithArray(this.rangeStart, this.rangeItems!.length, this.rangeItems!)
      this.rangeStart = -1
      this.rangeItems = undefined
    }
  }
}

function getValueAfterSplice<T>(
  array: readonly T[],
  i: number,
  index: number,
  remove: number,
  addedItems: readonly T[]
) {
  const base = i - index
  if (base < 0) {
    return array[i]
  }

  if (base < addedItems.length) {
    return addedItems[base]
  }

  return array[i - addedItems.length + remove]
}
