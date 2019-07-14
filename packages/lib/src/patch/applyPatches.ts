import { BuiltInAction } from "../action/builtInActions"
import { ActionContextActionType } from "../action/context"
import { wrapInAction } from "../action/wrapInAction"
import { Model } from "../model/Model"
import { Patch } from "../patch/Patch"
import { fromSnapshot } from "../snapshot/fromSnapshot"
import { reconcileSnapshot } from "../snapshot/reconcileSnapshot"
import { assertTweakedObject } from "../tweaker/core"
import { failure, inDevMode, isArray } from "../utils"

/**
 * Applies the given patches to the given target object.
 *
 * @param obj Target object.
 * @param patches List of patches to apply.
 */
export function applyPatches(obj: object, patches: Patch[]): void {
  assertTweakedObject(obj, "applyPatches")

  wrappedInternalApplyPatches.call(obj, patches)
}

function internalApplyPatches(this: object, patches: Patch[]): void {
  const obj = this

  patches.forEach(patch => applySinglePatch(obj, patch))
}

const wrappedInternalApplyPatches = wrapInAction(
  BuiltInAction.ApplyPatches,
  internalApplyPatches,
  ActionContextActionType.Sync
)

function applySinglePatch(obj: object, patch: Patch): void {
  const { target, prop } = pathArrayToObjectAndProp(obj, patch.path)

  if (isArray(target)) {
    switch (patch.op) {
      case "add": {
        const index = +prop!
        // no reconciliation, new value
        target.splice(index, 0, fromSnapshot(patch.value))
        break
      }

      case "remove": {
        const index = +prop!
        // no reconciliation, removing
        target.splice(index, 1)
        break
      }

      case "replace": {
        if (prop === "length") {
          target.length = patch.value
        } else {
          const index = +prop!
          // try to reconcile
          target[index] = reconcileSnapshot(target[index], patch.value)
        }
        break
      }

      default:
        throw failure(`unsupported patch operation: ${(patch as any).op}`)
    }
  } else {
    switch (patch.op) {
      case "add": {
        // no reconciliation, new value
        target[prop!] = fromSnapshot(patch.value)
        break
      }

      case "remove": {
        // no reconciliation, removing
        delete target[prop!]
        break
      }

      case "replace": {
        // try to reconcile
        target[prop!] = reconcileSnapshot(target[prop!], patch.value)
        break
      }

      default:
        throw failure(`unsupported patch operation: ${(patch as any).op}`)
    }
  }
}

function pathArrayToObjectAndProp(
  obj: object,
  path: Patch["path"]
): { target: any; prop?: string | number } {
  if (inDevMode()) {
    if (!Array.isArray(path)) {
      throw failure(`invalid path: ${path}`)
    }
  }

  if (path.length === 0) {
    return {
      target: obj,
    }
  }

  let target: any = obj
  if (target instanceof Model) {
    target = target.data
  }
  for (let i = 0; i <= path.length - 2; i++) {
    target = target[path[i]]
    if (target instanceof Model) {
      target = target.data
    }
  }

  return {
    target,
    prop: path[path.length - 1],
  }
}
