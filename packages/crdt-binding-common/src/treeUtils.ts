import {
  findParent,
  fromSnapshot,
  frozen,
  getGlobalConfig,
  getModelMetadata,
  getSnapshot,
  isFrozenSnapshot,
  isModel,
  isTreeNode,
  ModelAutoTypeCheckingMode,
} from "mobx-keystone"

/**
 * Creates the stored tree value for an incoming snapshot value.
 * @internal
 */
export function reviveValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  return isFrozenSnapshot(value) ? frozen(value.data) : fromSnapshot(value)
}

/**
 * The snapshot of a tree node, or the value itself when it is a plain value.
 * @internal
 */
export function getSnapshotValue(value: unknown): unknown {
  return isTreeNode(value) ? getSnapshot(value) : value
}

/**
 * Whether automatic model type checking can validate edits to this node.
 * @internal
 */
export function mayRequireTypeChecking(target: unknown): boolean {
  if (
    getGlobalConfig().modelAutoTypeChecking === ModelAutoTypeCheckingMode.AlwaysOff ||
    !isTreeNode(target)
  )
    return false
  return (
    (isModel(target) && !!getModelMetadata(target).dataType) ||
    !!findParent(target, (parent) => isModel(parent) && !!getModelMetadata(parent).dataType)
  )
}

/**
 * The longest path shared by every given path.
 * @internal
 */
export function commonPathPrefix(
  paths: Iterable<readonly (string | number)[]>
): (string | number)[] | undefined {
  let result: (string | number)[] | undefined
  for (const path of paths) {
    if (result === undefined) {
      result = [...path]
      continue
    }
    let length = 0
    while (length < result.length && result[length] === path[length]) length++
    result.length = length
  }
  return result
}

/**
 * Assigns an own data property, so keys such as `__proto__` remain ordinary data.
 * @internal
 */
export function setOwnProperty(target: object, key: string | number, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
}
