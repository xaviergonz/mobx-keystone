import { remove, set } from "mobx"
import { BuiltInAction } from "../action/builtInActions"
import { ActionContextActionType } from "../action/context"
import { wrapInAction } from "../action/wrapInAction"
import { modelToDataNode } from "../parent/core"
import { PathElement } from "../parent/pathTypes"
import { Patch } from "../patch/Patch"
import { reconcileSnapshot } from "../snapshot/reconcileSnapshot"
import { assertTweakedObject } from "../tweaker/core"
import { failure, inDevMode, isArray } from "../utils"
import { ModelPool } from "../utils/ModelPool"

/**
 * Applies the given patches to the given target object.
 *
 * @param node Target object.
 * @param patches List of patches to apply.
 * @param reverse Whether patches are applied in reverse order.
 */
export function applyPatches(
  node: object,
  patches: ReadonlyArray<Patch> | ReadonlyArray<ReadonlyArray<Patch>>,
  reverse: boolean = false
): void {
  assertTweakedObject(node, "node")

  if (patches.length <= 0) {
    return
  }

  wrappedInternalApplyPatches.call(node, patches, reverse)
}

/**
 * @ignore
 * @internal
 */
export function internalApplyPatches(
  this: object,
  patches: ReadonlyArray<Patch> | ReadonlyArray<ReadonlyArray<Patch>>,
  reverse: boolean = false
): void {
  const obj = this
  const modelPool = new ModelPool(obj)

  if (reverse) {
    let i = patches.length
    while (i--) {
      const p = patches[i]
      if (!isArray(p)) {
        applySinglePatch(obj, p as Patch, modelPool)
      } else {
        let j = p.length
        while (j--) {
          applySinglePatch(obj, p[j], modelPool)
        }
      }
    }
  } else {
    const len = patches.length
    for (let i = 0; i < len; i++) {
      const p = patches[i]
      if (!isArray(p)) {
        applySinglePatch(obj, p as Patch, modelPool)
      } else {
        const len2 = p.length
        for (let j = 0; j < len2; j++) {
          applySinglePatch(obj, p[j], modelPool)
        }
      }
    }
  }
}

const wrappedInternalApplyPatches = wrapInAction(
  BuiltInAction.ApplyPatches,
  internalApplyPatches,
  ActionContextActionType.Sync
)

function applySinglePatch(obj: object, patch: Patch, modelPool: ModelPool): void {
  const { target, prop } = pathArrayToObjectAndProp(obj, patch.path)

  if (isArray(target)) {
    switch (patch.op) {
      case "add": {
        const index = +prop!
        // reconcile from the pool if possible
        const newValue = reconcileSnapshot(undefined, patch.value, modelPool)
        target.splice(index, 0, newValue)
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
          const newValue = reconcileSnapshot(target[index], patch.value, modelPool)
          set(target, index as any, newValue)
        }
        break
      }

      default:
        throw failure(`unsupported patch operation: ${(patch as any).op}`)
    }
  } else {
    switch (patch.op) {
      case "add": {
        // reconcile from the pool if possible
        const newValue = reconcileSnapshot(undefined, patch.value, modelPool)
        set(target, prop, newValue)
        break
      }

      case "remove": {
        // no reconciliation, removing
        remove(target, prop)
        break
      }

      case "replace": {
        // try to reconcile
        // we don't need to tweak the pool since reconcileSnapshot will do that for us
        const newValue = reconcileSnapshot(target[prop!], patch.value, modelPool)
        set(target, prop, newValue)
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
): { target: any; prop?: PathElement } {
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
