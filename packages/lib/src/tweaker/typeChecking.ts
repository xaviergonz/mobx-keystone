import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import type { AnyModel } from "../model/BaseModel"
import { getModelMetadata } from "../model/getModelMetadata"
import { isModel } from "../model/utils"
import { dataToModelNode } from "../parent/core"
import { fastGetParentPathIncludingDataObjects, fastIsModelDataObject } from "../parent/path"
import type { Path, PathElement } from "../parent/pathTypes"
import { internalApplyPatches } from "../patch/applyPatches"
import { InternalPatchRecorder } from "../patch/emitPatch"
import type { Patch } from "../patch/Patch"
import { internalApplySnapshot } from "../snapshot/applySnapshot"
import { typesModel } from "../types/objectBased/typesModel"
import { invalidateCachedTypeCheckerResult } from "../types/TypeChecker"
import { typeCheckInternal } from "../types/typeCheck"
import { type TouchedChildren } from "../types/typeCheckScope"
import { runWithoutSnapshotOrPatches } from "./core"
import { isTypeCheckingAllowed } from "./withoutTypeChecking"

/**
 * @internal
 */
export function runTypeCheckingAfterChange(
  obj: object,
  patchRecorder: InternalPatchRecorder | undefined,
  snapshotBeforeChanges?: object
) {
  if (!isTypeCheckingAllowed()) {
    return
  }

  if (patchRecorder && patchRecorder.patches.length <= 0) {
    // No patches means no effective change.
    return
  }

  const touchedChildrenRelativeToChangedObj = getTouchedChildrenRelativeToChangedObj(
    patchRecorder?.patches
  )

  // invalidate type check cached result
  invalidateCachedTypeCheckerResult(obj, touchedChildrenRelativeToChangedObj)

  if (isModelAutoTypeCheckingEnabled()) {
    const parentWithPath = findNearestParentModelWithTypeCheckerAndPath(obj)
    if (parentWithPath) {
      const { parentModelWithTypeChecker, pathToChangedObj } = parentWithPath
      const err = typeCheckInternal<any>(
        typesModel<any, any>(parentModelWithTypeChecker.constructor as any),
        parentModelWithTypeChecker as any,
        pathToChangedObj,
        touchedChildrenRelativeToChangedObj
      )
      if (err) {
        // quietly apply inverse patches (do not generate patches, snapshots, actions, etc)
        runWithoutSnapshotOrPatches(() => {
          if (patchRecorder) {
            internalApplyPatches.call(obj, patchRecorder.invPatches, true)
          } else if (snapshotBeforeChanges) {
            internalApplySnapshot.call(obj, snapshotBeforeChanges)
          }
        })
        // at the end of apply patches it will be type checked again and its result cached once more
        err.throw()
      }
    }
  }
}

function getTouchedChildrenRelativeToChangedObj(
  patches: ReadonlyArray<Patch> | undefined
): TouchedChildren {
  if (!patches) {
    return "all"
  }

  const patchesLength = patches.length
  if (patchesLength <= 0) {
    return new Set<PathElement>()
  }

  // Hot path: most updates produce a single patch.
  const firstTouchedPathElement = patches[0].path[0]
  if (patchesLength === 1) {
    return new Set<PathElement>([firstTouchedPathElement])
  }

  const seenTouchedChildren = new Set<PathElement>()
  for (let i = 0; i < patchesLength; i++) {
    // we only support single-segment paths in the patch recorder, so this will always be the direct child of the changed object
    const touchedPathElement = patches[i].path[0]
    seenTouchedChildren.add(touchedPathElement)
  }
  return seenTouchedChildren
}

/**
 * @internal
 *
 * Finds the closest parent model that has a type checker defined.
 *
 * @param child
 * @returns
 */
function findNearestParentModelWithTypeCheckerAndPath(child: object):
  | {
      parentModelWithTypeChecker: AnyModel
      pathToChangedObj: Path
    }
  | undefined {
  // child might be .$, so we need to check the parent model in that case
  const actualChild = dataToModelNode(child)

  if (child !== actualChild) {
    child = actualChild
    if (isModel(child) && !!getModelMetadata(child).dataType) {
      return {
        parentModelWithTypeChecker: child,
        pathToChangedObj: [],
      }
    }
  }

  const pathToChangedObj: PathElement[] = []
  let current: object | undefined = child
  while (current !== undefined) {
    const parentPath: { parent: object; path: PathElement } | undefined =
      fastGetParentPathIncludingDataObjects(current, false)
    if (!parentPath) {
      return undefined
    }

    const isModelDataBoundaryHop = parentPath.path === "$" && fastIsModelDataObject(current)
    if (!isModelDataBoundaryHop) {
      pathToChangedObj.unshift(parentPath.path)
    }

    const parent: object = parentPath.parent
    if (isModel(parent) && !!getModelMetadata(parent).dataType) {
      return {
        parentModelWithTypeChecker: parent,
        pathToChangedObj,
      }
    }

    current = parent
  }

  return undefined
}
