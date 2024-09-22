import { runInAction } from "mobx"
import { applyAction } from "../../action/applyAction"
import { frozenKey } from "../../frozen/Frozen"
import { getModelIdPropertyName } from "../../model/getModelMetadata"
import { isModel } from "../../model/utils"
import { resolvePath } from "../../parent/path"
import type { WritablePath } from "../../parent/pathTypes"
import { applyPatches } from "../../patch/applyPatches"
import { onPatches } from "../../patch/emitPatch"
import type { Patch } from "../../patch/Patch"
import { assertTweakedObject } from "../../tweaker/core"
import { failure, isObject } from "../../utils"
import { deserializeActionCall, SerializedActionCall } from "./actionSerialization"

/**
 * Serialized action call with model ID overrides.
 * Can be generated with `applySerializedActionAndTrackNewModelIds`.
 * To be applied with `applySerializedActionAndSyncNewModelIds`.
 */
export interface SerializedActionCallWithModelIdOverrides extends SerializedActionCall {
  /**
   * Model Id overrides to be applied at the end of applying the action.
   */
  readonly modelIdOverrides: ReadonlyArray<Patch>
}

/**
 * Applies (runs) a serialized action over a target object.
 * In this mode newly generated / modified model IDs will be tracked
 * so they can be later synchronized when applying it on another machine
 * via `applySerializedActionAndSyncNewModelIds`.
 * This means this method is usually used on the server side.
 *
 * If you intend to apply non-serialized actions check `applyAction` instead.
 *
 * @param subtreeRoot Subtree root target object to run the action over.
 * @param call The serialized action, usually as coming from the server/client.
 * @returns The return value of the action, if any, plus a new serialized action
 * with model overrides.
 */
export function applySerializedActionAndTrackNewModelIds<TRet = any>(
  subtreeRoot: object,
  call: SerializedActionCall
): {
  returnValue: TRet
  serializedActionCall: SerializedActionCallWithModelIdOverrides
} {
  if (!call.serialized) {
    throw failure("cannot apply a non-serialized action call, use 'applyAction' instead")
  }

  assertTweakedObject(subtreeRoot, "subtreeRoot")

  const deserializedCall = deserializeActionCall(call, subtreeRoot)

  const modelIdOverrides: Patch[] = []

  // set a patch listener to track changes to model ids
  const patchDisposer = onPatches(subtreeRoot, (patches) => {
    scanPatchesForModelIdChanges(subtreeRoot, modelIdOverrides, patches)
  })

  try {
    const returnValue = applyAction(subtreeRoot, deserializedCall)

    return {
      returnValue,
      serializedActionCall: {
        ...call,
        modelIdOverrides,
      },
    }
  } finally {
    patchDisposer()
  }
}

function scanPatchesForModelIdChanges(root: object, modelIdOverrides: Patch[], patches: Patch[]) {
  const len = patches.length
  for (let i = 0; i < len; i++) {
    const patch = patches[i]
    if (patch.op === "replace" || patch.op === "add") {
      deepScanValueForModelIdChanges(
        root,
        modelIdOverrides,
        patch.value,
        patch.path as WritablePath
      )
    }
  }
}

function deepScanValueForModelIdChanges(
  root: object,
  modelIdOverrides: Patch[],
  value: any,
  path: WritablePath
) {
  if (path.length > 0 && typeof value === "string") {
    // ensure the parent is an actual model
    const parent = resolvePath(root, path.slice(0, path.length - 1)).value

    if (isModel(parent)) {
      const propertyName = path[path.length - 1]
      if (propertyName === getModelIdPropertyName(parent.constructor as any)) {
        // found one
        modelIdOverrides.push({
          op: "replace",
          path: path.slice(),
          value: value,
        })
      }
    }
  } else if (Array.isArray(value)) {
    const len = value.length
    for (let i = 0; i < len; i++) {
      path.push(i)
      deepScanValueForModelIdChanges(root, modelIdOverrides, value[i], path)
      path.pop()
    }
  } else if (isObject(value)) {
    // skip frozen values
    if (!value[frozenKey]) {
      const keys = Object.keys(value)
      const len = keys.length
      for (let i = 0; i < len; i++) {
        const propName = keys[i]
        const propValue = value[propName]

        path.push(propName)
        deepScanValueForModelIdChanges(root, modelIdOverrides, propValue, path)
        path.pop()
      }
    }
  }
}

/**
 * Applies (runs) a serialized action over a target object.
 * In this mode newly generated / modified model IDs previously tracked
 * by `applySerializedActionAndTrackNewModelIds` will be synchronized after
 * the action is applied.
 * This means this method is usually used on the client side.
 *
 * If you intend to apply non-serialized actions check `applyAction` instead.
 *
 * @param subtreeRoot Subtree root target object to run the action over.
 * @param call The serialized action, usually as coming from the server/client.
 * @returns The return value of the action, if any.
 */
export function applySerializedActionAndSyncNewModelIds<TRet = any>(
  subtreeRoot: object,
  call: SerializedActionCallWithModelIdOverrides
): TRet {
  if (!call.serialized) {
    throw failure("cannot apply a non-serialized action call, use 'applyAction' instead")
  }

  assertTweakedObject(subtreeRoot, "subtreeRoot")

  const deserializedCall = deserializeActionCall(call, subtreeRoot)

  let returnValue: any
  runInAction(() => {
    returnValue = applyAction(subtreeRoot, deserializedCall)

    // apply model id overrides
    applyPatches(subtreeRoot, call.modelIdOverrides)
  })

  return returnValue
}
