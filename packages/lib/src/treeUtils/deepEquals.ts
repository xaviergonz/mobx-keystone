import fastDeepEqual from "fast-deep-equal/es6"
import { isObservable, toJS } from "mobx"
import { getSnapshot } from "../snapshot"
import { isTreeNode } from "../tweaker"
import { getMobxVersion } from "../utils"

/**
 * Deeply compares two values.
 *
 * Supported values are:
 * - Primitives
 * - Boxed observables
 * - Objects, observable objects
 * - Arrays, observable arrays
 * - Typed arrays
 * - Maps, observable maps
 * - Sets, observable sets
 * - Tree nodes (optimized by using snapshot comparison internally)
 *
 * Note that in the case of models the result will be false if their model IDs are different.
 *
 * @param a First value to compare.
 * @param b Second value to compare.
 * @returns `true` if they are the equivalent, `false` otherwise.
 */
export function deepEquals(a: any, b: any): boolean {
  // quick check for reference
  if (a === b) {
    return true
  }

  const aIsObject = a !== null && typeof a === "object"
  const bIsObject = b !== null && typeof b === "object"
  if (!aIsObject && !bIsObject) {
    // Strict equality already handled all equal primitives except NaN.
    return Number.isNaN(a) && Number.isNaN(b)
  }

  return fastDeepEqual(aIsObject ? comparisonValue(a) : a, bIsObject ? comparisonValue(b) : b)
}

function comparisonValue(value: object): unknown {
  if (isTreeNode(value)) {
    // Snapshots preserve structural sharing. Model $ objects are deliberately
    // handled as observable objects rather than standalone tree nodes.
    return getSnapshot(value)
  }
  return isObservable(value) ? toJS(value, toJSOptions) : value
}

const toJSOptions =
  getMobxVersion() >= 6
    ? undefined
    : {
        exportMapsAsObjects: false,
        recurseEverything: false,
      }
