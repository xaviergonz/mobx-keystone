import { remove, set } from "mobx"
import { BuiltInAction } from "../action/builtInActions"
import { ActionContextActionType } from "../action/context"
import { wrapInAction } from "../action/wrapInAction"
import { modelToDataNode } from "../parent/core"
import { Patch } from "../patch/Patch"
import { fromSnapshot } from "../snapshot/fromSnapshot"
import { reconcileSnapshot } from "../snapshot/reconcileSnapshot"
import { assertTweakedObject } from "../tweaker/core"
import { failure, inDevMode, isArray } from "../utils"

/**
 * Applies the given patches to the given target object.
 *
 * @param node Target object.
 * @param patches List of patches to apply.
 */
export function applyPatches(node: object, patches: ReadonlyArray<Patch>): void {
  assertTweakedObject(node, "node")

  wrappedInternalApplyPatches.call(node, patches)
}

/**
 * @ignore
 */
export function internalApplyPatches(this: object, patches: ReadonlyArray<Patch>): void {
  const obj = this

  const len = patches.length
  for (let i = 0; i < len; i++) {
    applySinglePatch(obj, patches[i])
  }
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
          set(target, index as any, reconcileSnapshot(target[index], patch.value))
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
        set(target, prop, fromSnapshot(patch.value))
        break
      }

      case "remove": {
        // no reconciliation, removing
        remove(target, prop)
        break
      }

      case "replace": {
        // try to reconcile
        set(target, prop, reconcileSnapshot(target[prop!], patch.value))
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
    if (!isArray(path)) {
      throw failure(`invalid path: ${path}`)
    }
  }

  let target: any = modelToDataNode(obj)

  if (path.length === 0) {
    return {
      target,
    }
  }

  for (let i = 0; i <= path.length - 2; i++) {
    target = modelToDataNode(target[path[i]])
  }

  return {
    target,
    prop: path[path.length - 1],
  }
}
