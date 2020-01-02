import { action, computed } from "mobx"
import { pathToTargetPathIds } from "../actionMiddlewares/utils"
import { resolvePath, resolvePathCheckingIds, skipIdChecking } from "../parent/path"
import { Path } from "../parent/pathTypes"
import { applyPatches } from "../patch/applyPatches"
import { applySnapshot } from "../snapshot/applySnapshot"
import { fromSnapshot } from "../snapshot/fromSnapshot"
import { getSnapshot } from "../snapshot/getSnapshot"
import { assertTweakedObject } from "../tweaker/core"
import { failure } from "../utils"
import { deepEquals } from "./deepEquals"

/**
 * A class with the implementationm of draft.
 * Use `draft` to create an instance of this class.
 *
 * @typeparam T Data type.
 */
export class Draft<T extends object> {
  /**
   * Draft data object.
   */
  readonly data: T

  /**
   * Commits current draft changes to the original object.
   */
  @action
  commit(): void {
    applySnapshot(this.originalData, getSnapshot(this.data))
  }

  /**
   * Partially commits current draft changes to the original object.
   * If the path cannot be resolved in either the draft or the original object it will throw.
   * Note that model IDs are checked to be the same when resolving the paths.
   *
   * @param path Path to commit.
   */
  @action
  commitByPath(path: Path): void {
    const draftTarget = resolvePath(this.data, path)
    if (!draftTarget.resolved) {
      throw failure(`path ${JSON.stringify(path)} could not be resolved in draft object`)
    }

    const draftPathIds = pathToTargetPathIdsIgnoringLast(this.data, path)

    const originalTarget = resolvePathCheckingIds(this.originalData, path, draftPathIds)
    if (!originalTarget.resolved) {
      throw failure(`path ${JSON.stringify(path)} could not be resolved in original object`)
    }

    applyPatches(this.originalData, [
      {
        path,
        op: "replace",
        value: getSnapshot(draftTarget.value),
      },
    ])
  }

  /**
   * Resets the draft to be an exact copy of the current state of the original object.
   */
  @action
  reset(): void {
    applySnapshot(this.data, this.originalSnapshot)
  }

  /**
   * Partially resets current draft changes to be the same as the original object.
   * If the path cannot be resolved in either the draft or the original object it will throw.
   * Note that model IDs are checked to be the same when resolving the paths.
   *
   * @param path Path to reset.
   */
  @action
  resetByPath(path: Path): void {
    const originalTarget = resolvePath(this.originalData, path)
    if (!originalTarget.resolved) {
      throw failure(`path ${JSON.stringify(path)} could not be resolved in original object`)
    }

    const originalPathIds = pathToTargetPathIdsIgnoringLast(this.originalData, path)

    const draftTarget = resolvePathCheckingIds(this.data, path, originalPathIds)
    if (!draftTarget.resolved) {
      throw failure(`path ${JSON.stringify(path)} could not be resolved in draft object`)
    }

    applyPatches(this.data, [
      {
        path,
        op: "replace",
        value: getSnapshot(originalTarget.value),
      },
    ])
  }

  /**
   * Returns `true` if the draft has changed compared to the original object, `false` otherwise.
   */
  @computed
  get isDirty(): boolean {
    return !deepEquals(getSnapshot(this.data), this.originalSnapshot)
  }

  /**
   * Returns `true` if the value at the given path of the draft has changed compared to the original object.
   * If the path cannot be resolved in the draft it will throw.
   * If the path cannot be resolved in the original object it will return `true`.
   * Note that model IDs are checked to be the same when resolving the paths.
   *
   * @param path Path to check.
   */
  isDirtyByPath(path: Path): boolean {
    const draftTarget = resolvePath(this.data, path)
    if (!draftTarget.resolved) {
      throw failure(`path ${JSON.stringify(path)} could not be resolved in draft object`)
    }

    const draftPathIds = pathToTargetPathIdsIgnoringLast(this.data, path)

    const originalTarget = resolvePathCheckingIds(this.originalData, path, draftPathIds)
    if (!originalTarget.resolved) {
      return true
    }

    return !deepEquals(draftTarget.value, originalTarget.value)
  }

  /**
   * Original data object.
   */
  readonly originalData: T

  @computed
  private get originalSnapshot() {
    return getSnapshot(this.originalData)
  }

  /**
   * Creates an instance of Draft.
   * Do not use directly, use `draft` instead.
   *
   * @param original
   */
  constructor(original: T) {
    assertTweakedObject(original, "original")

    this.originalData = original
    this.data = fromSnapshot(this.originalSnapshot, { generateNewIds: false })
  }
}

/**
 * Creates a draft copy of a tree node and all its children.
 *
 * @typeparam T Data type.
 * @param original Original node.
 * @returns The draft object.
 */
export function draft<T extends object>(original: T): Draft<T> {
  return new Draft(original)
}

function pathToTargetPathIdsIgnoringLast(root: any, path: Path) {
  const pathIds: (string | null | typeof skipIdChecking)[] = pathToTargetPathIds(root, path)
  if (pathIds.length >= 1) {
    // never check the last object id
    pathIds[pathIds.length - 1] = skipIdChecking
  }

  return pathIds
}
