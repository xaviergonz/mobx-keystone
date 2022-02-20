import { computed, IComputedValue } from "mobx"
import { modelIdKey } from "../model/metadata"
import { isModel } from "../model/utils"
import { assertTweakedObject } from "../tweaker/core"
import { isArray, isObject } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import {
  dataObjectParent,
  dataToModelNode,
  modelToDataNode,
  objectParents,
  reportParentPathObserved,
} from "./core"
import type { Path, PathElement, WritablePath } from "./pathTypes"

/**
 * Path from an object to its immediate parent.
 *
 * @typeparam T Parent object type.
 */
export interface ParentPath<T extends object> {
  /**
   * Parent object.
   */
  readonly parent: T
  /**
   * Property name (if the parent is an object) or index number (if the parent is an array).
   */
  readonly path: PathElement
}

/**
 * Path from an object to its root.
 *
 * @typeparam T Root object type.
 */
export interface RootPath<T extends object> {
  /**
   * Root object.
   */
  readonly root: T
  /**
   * Path from the root to the given target, as a string array.
   * If the target is a root itself then the array will be empty.
   */
  readonly path: Path

  /**
   * Objects in the path, from root (included) until target (included).
   * If the target is a root then only the target will be included.
   */
  readonly pathObjects: ReadonlyArray<unknown>
}

/**
 * Returns the parent of the target plus the path from the parent to the target, or undefined if it has no parent.
 *
 * @typeparam T Parent object type.
 * @param value Target object.
 * @returns
 */
export function getParentPath<T extends object = any>(value: object): ParentPath<T> | undefined {
  assertTweakedObject(value, "value")

  return fastGetParentPath(value)
}

/**
 * @internal
 */
export function fastGetParentPath<T extends object = any>(
  value: object
): ParentPath<T> | undefined {
  reportParentPathObserved(value)
  return objectParents.get(value) as any
}

/**
 * @internal
 */
export function fastGetParentPathIncludingDataObjects<T extends object = any>(
  value: object
): ParentPath<T> | undefined {
  const parentModel = dataObjectParent.get(value)
  if (parentModel) {
    return { parent: parentModel as T, path: "$" }
  }

  const parentPath = fastGetParentPath(value)
  if (parentPath && isModel(parentPath.parent)) {
    return { parent: parentPath.parent.$ as T, path: parentPath.path }
  }
  return parentPath
}

/**
 * Returns the parent object of the target object, or undefined if there's no parent.
 *
 * @typeparam T Parent object type.
 * @param value Target object.
 * @returns
 */
export function getParent<T extends object = any>(value: object): T | undefined {
  assertTweakedObject(value, "value")

  return fastGetParent(value)
}

/**
 * @internal
 */
export function fastGetParent<T extends object = any>(value: object): T | undefined {
  const parentPath = fastGetParentPath(value)

  return parentPath ? parentPath.parent : undefined
}

/**
 * @internal
 */
export function fastGetParentIncludingDataObjects<T extends object = any>(
  value: object
): T | undefined {
  const parentPath = fastGetParentPathIncludingDataObjects(value)

  return parentPath ? parentPath.parent : undefined
}

/**
 * Returns if a given object is a model interim data object (`$`).
 *
 * @param value Object to check.
 * @returns true if it is, false otherwise.
 */
export function isModelDataObject(value: object): boolean {
  assertTweakedObject(value, "value", true)

  return fastIsModelDataObject(value)
}

/**
 * @internal
 */
export function fastIsModelDataObject(value: object): boolean {
  return dataObjectParent.has(value)
}

/**
 * Returns the root of the target plus the path from the root to get to the target.
 *
 * @typeparam T Root object type.
 * @param value Target object.
 * @returns
 */
export function getRootPath<T extends object = any>(value: object): RootPath<T> {
  assertTweakedObject(value, "value")

  return fastGetRootPath(value)
}

// we use computeds so they are cached whenever possible
const computedsGetRootPath = new WeakMap<object, IComputedValue<RootPath<any>>>()

function internalGetRootPath<T extends object = any>(value: object): RootPath<T> {
  const rootPath = {
    root: value,
    path: [] as WritablePath,
    pathObjects: [value] as unknown[],
  }

  let parentPath: ParentPath<any> | undefined
  while ((parentPath = fastGetParentPath(rootPath.root))) {
    rootPath.root = parentPath.parent
    rootPath.path.unshift(parentPath.path)
    rootPath.pathObjects.unshift(parentPath.parent)
  }

  return rootPath as RootPath<any>
}

/**
 * @internal
 */
export function fastGetRootPath<T extends object = any>(value: object): RootPath<T> {
  return getOrCreate(computedsGetRootPath, value, () =>
    computed(() => {
      return internalGetRootPath(value)
    })
  ).get()
}

/**
 * Returns the root of the target object, or itself if the target is a root.
 *
 * @typeparam T Root object type.
 * @param value Target object.
 * @returns
 */
export function getRoot<T extends object = any>(value: object): T {
  assertTweakedObject(value, "value")

  return fastGetRoot(value)
}

/**
 * @internal
 */
export function fastGetRoot<T extends object = any>(value: object): T {
  return fastGetRootPath(value).root
}

/**
 * Returns if a given object is a root object.
 *
 * @param value Target object.
 * @returns
 */
export function isRoot(value: object): boolean {
  assertTweakedObject(value, "value")

  return !fastGetParent(value)
}

const unresolved = { resolved: false } as const

/**
 * Tries to resolve a path from an object.
 *
 * @typeparam T Returned value type.
 * @param pathRootObject Object that serves as path root.
 * @param path Path as an string or number array.
 * @returns An object with `{ resolved: true, value: T }` or `{ resolved: false }`.
 */
export function resolvePath<T = any>(
  pathRootObject: object,
  path: Path
):
  | {
      resolved: true
      value: T
    }
  | {
      resolved: false
      value?: undefined
    } {
  // unit tests rely on this to work with any object
  // assertTweakedObject(pathRootObject, "pathRootObject")

  let current: any = pathRootObject

  let len = path.length
  for (let i = 0; i < len; i++) {
    if (!isObject(current)) {
      return unresolved
    }

    const p = path[i]

    // check just to avoid mobx warnings about trying to access out of bounds index
    if (isArray(current) && +p >= current.length) {
      return unresolved
    }

    if (isModel(current)) {
      const dataNode = modelToDataNode(current)
      if (p in dataNode) {
        current = dataNode
      } else if (!(p in current)) {
        return unresolved
      }
    }

    current = current[p]
  }

  return { resolved: true, value: current }
}

/**
 * @internal
 */
export const skipIdChecking = Symbol("skipIdChecking")

/**
 * @internal
 *
 * Tries to resolve a path from an object while checking ids.
 *
 * @typeparam T Returned value type.
 * @param pathRootObject Object that serves as path root.
 * @param path Path as an string or number array.
 * @param pathIds An array of ids of the models that must be checked, null if not a model or `skipIdChecking` to skip it.
 * @returns An object with `{ resolved: true, value: T }` or `{ resolved: false }`.
 */
export function resolvePathCheckingIds<T = any>(
  pathRootObject: object,
  path: Path,
  pathIds: ReadonlyArray<string | null | typeof skipIdChecking>
):
  | {
      resolved: true
      value: T
    }
  | {
      resolved: false
      value?: undefined
    } {
  // unit tests rely on this to work with any object
  // assertTweakedObject(pathRootObject, "pathRootObject")

  let current: any = modelToDataNode(pathRootObject)
  // root id is never checked

  let len = path.length
  for (let i = 0; i < len; i++) {
    if (!isObject(current)) {
      return { resolved: false }
    }

    const p = path[i]

    // check just to avoid mobx warnings about trying to access out of bounds index
    if (isArray(current) && +p >= current.length) {
      return { resolved: false }
    }

    const currentMaybeModel = current[p]
    current = modelToDataNode(currentMaybeModel as object)

    const expectedId = pathIds[i]
    if (expectedId !== skipIdChecking) {
      const currentId = isModel(currentMaybeModel) ? currentMaybeModel[modelIdKey] ?? null : null
      if (expectedId !== currentId) {
        return { resolved: false }
      }
    }
  }

  return { resolved: true, value: dataToModelNode(current) }
}

/**
 * Gets the path to get from a parent to a given child.
 * Returns an empty array if the child is actually the given parent or undefined if the child is not a child of the parent.
 *
 * @param fromParent
 * @param toChild
 * @returns
 */
export function getParentToChildPath(fromParent: object, toChild: object): Path | undefined {
  assertTweakedObject(fromParent, "fromParent")
  assertTweakedObject(toChild, "toChild")

  if (fromParent === toChild) {
    return []
  }

  const path: WritablePath = []

  let current = toChild
  let parentPath
  while ((parentPath = fastGetParentPath(current))) {
    path.unshift(parentPath.path)

    current = parentPath.parent
    if (current === fromParent) {
      return path
    }
  }
  return undefined
}
