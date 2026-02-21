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
import { getTypeInfo } from "../types/getTypeInfo"
import { typesModel } from "../types/objectBased/typesModel"
import type { TypeInfo } from "../types/TypeChecker"
import { invalidateCachedTypeCheckerResult } from "../types/TypeChecker"
import { typeCheckInternal } from "../types/typeCheck"
import { type TouchedChildren } from "../types/typeCheckScope"
import { failure } from "../utils"
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
    const parentWithPath = findModelToTypeCheckAndPath(obj)
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
    throw failure("assertion error: patches must be non-empty when provided")
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

const refinementByModelPropCache = new WeakMap<object, Map<string, boolean>>()

function shouldPromoteForRefinement(model: AnyModel, firstPathElement: PathElement): boolean {
  if (typeof firstPathElement !== "string") {
    // Model data is object-like, so non-string paths are rare. Promote conservatively.
    return true
  }

  const modelClass = model.constructor as object
  let cache = refinementByModelPropCache.get(modelClass)
  if (!cache) {
    cache = new Map<string, boolean>()
    refinementByModelPropCache.set(modelClass, cache)
  }

  const cached = cache.get(firstPathElement)
  if (cached !== undefined) {
    return cached
  }

  const modelDataType = getModelMetadata(model).dataType
  const result =
    !!modelDataType &&
    typeInfoHasRefinementForTopLevelProp(
      getTypeInfo(modelDataType),
      firstPathElement,
      false,
      new WeakMap()
    )
  cache.set(firstPathElement, result)
  return result
}

function typeInfoHasRefinementForTopLevelProp(
  typeInfo: TypeInfo,
  targetTopLevelProp: string,
  selectedTopLevelProp: boolean,
  visited: WeakMap<TypeInfo, number>
): boolean {
  const visitedMask = visited.get(typeInfo) ?? 0
  const selectionBit = selectedTopLevelProp ? 0b10 : 0b01
  if (visitedMask & selectionBit) {
    return false
  }
  visited.set(typeInfo, visitedMask | selectionBit)

  if (typeInfo.kind === "refinement") {
    return true
  }

  if (!selectedTopLevelProp && typeInfo.isTopLevelPropertyContainer()) {
    // Navigate into the target prop of the top-level model.
    const propTypeInfo = typeInfo.getTopLevelPropertyTypeInfo(targetTopLevelProp)
    if (!propTypeInfo) {
      return false
    }
    return typeInfoHasRefinementForTopLevelProp(propTypeInfo, targetTopLevelProp, true, visited)
  }

  // Child models/data models handle their own type-checking,
  // so refinements inside them are irrelevant for promotion.
  if (selectedTopLevelProp && !typeInfo.shouldTraverseChildrenAfterTopLevelPropertySelection()) {
    return false
  }

  return !!typeInfo.findChildTypeInfo((childTypeInfo) =>
    typeInfoHasRefinementForTopLevelProp(
      childTypeInfo,
      targetTopLevelProp,
      selectedTopLevelProp,
      visited
    )
  )
}

function isModelWithTypeChecker(obj: object): obj is AnyModel {
  return isModel(obj) && !!getModelMetadata(obj).dataType
}

/**
 * @internal
 *
 * Finds the model that should be type-checked after a mutation.
 * Starts from the closest typed model and only promotes to ancestors when
 * refinements are present above the current selected model path.
 *
 * @param child
 * @returns
 */
function findModelToTypeCheckAndPath(child: object):
  | {
      parentModelWithTypeChecker: AnyModel
      pathToChangedObj: Path
    }
  | undefined {
  // child might be .$, so we need to check the parent model in that case
  let current: object | undefined = dataToModelNode(child)

  let selectedModel: AnyModel | undefined
  let selectedPathLength = 0

  // If the child was a model data object, the model itself may be the target
  if (child !== current && isModelWithTypeChecker(current)) {
    selectedModel = current
  }

  const pathToChangedObj: PathElement[] = []
  while (current !== undefined) {
    const parentPath: { parent: object; path: PathElement } | undefined =
      fastGetParentPathIncludingDataObjects(current, false)
    if (!parentPath) break

    if (!(parentPath.path === "$" && fastIsModelDataObject(current))) {
      pathToChangedObj.unshift(parentPath.path)
    }

    const parent: object = parentPath.parent
    if (isModelWithTypeChecker(parent)) {
      if (!selectedModel) {
        selectedModel = parent
        selectedPathLength = pathToChangedObj.length
      } else if (pathToChangedObj.length > selectedPathLength) {
        // pathToChangedObj[0] is always the immediate child prop of the
        // current parent model, which is what shouldPromoteForRefinement needs.
        if (shouldPromoteForRefinement(parent, pathToChangedObj[0])) {
          selectedModel = parent
          selectedPathLength = pathToChangedObj.length
        }
      }
    }

    current = parent
  }

  if (!selectedModel) return undefined

  return {
    parentModelWithTypeChecker: selectedModel,
    pathToChangedObj:
      selectedPathLength === pathToChangedObj.length
        ? pathToChangedObj
        : pathToChangedObj.slice(pathToChangedObj.length - selectedPathLength),
  }
}
