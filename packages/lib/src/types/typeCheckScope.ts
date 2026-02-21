import type { Path, PathElement } from "../parent/pathTypes"

export type TouchedChildren = "all" | ReadonlySet<PathElement>

export interface TypeCheckScope {
  readonly pathToChangedObj: Path
  /** Index into pathToChangedObj; avoids .slice() copies during descent. */
  readonly pathOffset: number
  readonly touchedChildren: TouchedChildren
}

const emptyPath: Path = []

const emptyTouchedChildren: ReadonlySet<PathElement> = new Set<PathElement>()

/**
 * Sentinel scope meaning "check everything". Use `isTypeCheckScopeAll` to test.
 * Do not construct scopes manually — always use `createTypeCheckScope`.
 */
export const allTypeCheckScope: TypeCheckScope = {
  pathToChangedObj: emptyPath,
  pathOffset: 0,
  touchedChildren: "all",
}

/**
 * Sentinel scope meaning "nothing to check". Use `isTypeCheckScopeEmpty` to test.
 * Do not construct scopes manually — always use `createTypeCheckScope`.
 */
export const emptyTypeCheckScope: TypeCheckScope = {
  pathToChangedObj: emptyPath,
  pathOffset: 0,
  touchedChildren: emptyTouchedChildren,
}

/**
 * @internal
 */
export function createTypeCheckScope(
  pathToChangedObj: Path,
  pathOffset: number,
  touchedChildren: TouchedChildren
): TypeCheckScope {
  if (pathOffset >= pathToChangedObj.length) {
    if (touchedChildren === "all") {
      return allTypeCheckScope
    }
    if (touchedChildren.size <= 0) {
      return emptyTypeCheckScope
    }
  }

  return {
    pathToChangedObj,
    pathOffset,
    touchedChildren,
  }
}

/**
 * @internal
 */
export function isTypeCheckScopeAll(typeCheckScope: TypeCheckScope): boolean {
  return typeCheckScope === allTypeCheckScope
}

/**
 * @internal
 */
export function isTypeCheckScopeEmpty(typeCheckScope: TypeCheckScope): boolean {
  return typeCheckScope === emptyTypeCheckScope
}

/**
 * @internal
 */
export function getChildCheckScope(
  typeCheckScope: TypeCheckScope,
  childPathElement: PathElement
): TypeCheckScope | null {
  const { pathToChangedObj, pathOffset, touchedChildren } = typeCheckScope
  const remainingLength = pathToChangedObj.length - pathOffset
  if (remainingLength > 0) {
    if (pathToChangedObj[pathOffset] !== childPathElement) {
      // different branch than the one touched: skip partial validation for this child
      return null
    }

    if (remainingLength === 1) {
      const childCheckScope = createTypeCheckScope(
        pathToChangedObj,
        pathToChangedObj.length,
        touchedChildren
      )
      if (isTypeCheckScopeEmpty(childCheckScope)) {
        // path is consumed but no child was touched under it
        return null
      }
      return childCheckScope
    }

    return createTypeCheckScope(pathToChangedObj, pathOffset + 1, touchedChildren)
  }

  if (touchedChildren === "all") {
    return allTypeCheckScope
  }
  return touchedChildren.has(childPathElement) ? allTypeCheckScope : null
}
