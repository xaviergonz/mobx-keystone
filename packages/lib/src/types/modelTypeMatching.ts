import { modelTypeKey } from "../model/metadata"
import { isObject } from "../utils"

/**
 * Model type matching pass used while unions match a value against their branches, so they can
 * prefer the branches whose models are the closest to the ones named by the snapshot
 * (`$modelType`):
 * - `none`: not matching union branches; model types match snapshots of their own model and of
 *   its subclasses.
 * - `exact`: model types only match snapshots of their own model.
 * - `closest`: model types also match snapshots of subclasses, adding how far the subclass is
 *   from the model to `subclassDistance`, so unions can pick the branch with the lowest total.
 *
 * @internal
 */
export type ModelTypeMatchingPass = "none" | "exact" | "closest"

let currentPass: ModelTypeMatchingPass = "none"
let subclassDistance = 0
let rejectedSubclass = false

/**
 * @internal
 */
export function getModelTypeMatchingPass(): ModelTypeMatchingPass {
  return currentPass
}

/**
 * Records that a model type matched a snapshot of a subclass `distance` levels below it.
 *
 * @internal
 */
export function addModelSubclassDistance(distance: number): void {
  if (currentPass === "closest") {
    subclassDistance += distance
  }
}

/**
 * Records that a model type rejected a snapshot of a subclass in the exact pass (so it would
 * match it in the closest pass).
 *
 * @internal
 */
export function rejectSubclassInExactPass(): void {
  rejectedSubclass = true
}

/**
 * Runs a value match, returning whether it matched, or `undefined` if it did not because a model
 * type rejected a snapshot of a subclass in the exact pass.
 *
 * @internal
 */
export function matchUnlessSubclassRejected<A, B>(
  fn: (a: A, b: B) => unknown,
  a: A,
  b: B
): boolean | undefined {
  const prevRejectedSubclass = rejectedSubclass
  rejectedSubclass = false
  try {
    const matched = !!fn(a, b)
    return matched || !rejectedSubclass ? matched : undefined
  } finally {
    // let outer matches know too
    rejectedSubclass ||= prevRejectedSubclass
  }
}

/**
 * Whether a value is a snapshot that names its model (`$modelType`).
 *
 * @internal
 */
export function hasSnapshotModelType(value: unknown): boolean {
  return isObject(value) && typeof value[modelTypeKey] === "string"
}

/**
 * Runs a function in the given model type matching pass, restoring the current one afterwards.
 *
 * @internal
 */
export function runInModelTypeMatchingPass<A, B, R>(
  pass: ModelTypeMatchingPass,
  fn: (a: A, b: B) => R,
  a: A,
  b: B
): R {
  if (pass === "none" && currentPass === "none") {
    return fn(a, b)
  }

  const prevPass = currentPass
  const prevDistance = subclassDistance
  const prevRejectedSubclass = rejectedSubclass
  currentPass = pass
  subclassDistance = 0
  rejectedSubclass = false
  try {
    return fn(a, b)
  } finally {
    currentPass = prevPass
    subclassDistance = prevDistance
    rejectedSubclass = prevRejectedSubclass
  }
}

/**
 * Finds the union branch (candidate) that matches a value, preferring branches that match the
 * exact models named by the snapshot (branches without models count as exact matches), then
 * the branches whose models are the closest base models of the snapshot ones (the fewest
 * subclass levels away in total), and the first one on ties.
 *
 * @internal
 */
export function findClosestModelTypeMatch<T, R>(
  candidates: ReadonlyArray<T>,
  match: (candidate: T, value: unknown) => R | null | undefined,
  value: unknown
): R | undefined {
  switch (currentPass) {
    case "exact": {
      // nested inside an exact pass
      const prevRejectedSubclass = rejectedSubclass
      const exactMatch = findFirstMatch(candidates, match, value)
      if (exactMatch != null) {
        // subclasses rejected by other branches do not matter then
        rejectedSubclass = prevRejectedSubclass
      }
      return exactMatch
    }
    case "closest":
      // nested inside a closest pass
      return findClosestMatch(candidates, match, value, 0)
    default:
      try {
        currentPass = "exact"
        const exactMatch = findFirstMatch(candidates, match, value)
        if (exactMatch != null) {
          return exactMatch
        }

        currentPass = "closest"
        subclassDistance = 0
        // no branch matched exactly, so none can be less than one subclass level away
        return findClosestMatch(candidates, match, value, 1)
      } finally {
        currentPass = "none"
        subclassDistance = 0
        rejectedSubclass = false
      }
  }
}

/**
 * Finds the first candidate that matches a value.
 *
 * @internal
 */
export function findFirstMatch<T, R>(
  candidates: ReadonlyArray<T>,
  match: (candidate: T, value: unknown) => R | null | undefined,
  value: unknown
): R | undefined {
  for (let i = 0; i < candidates.length; i++) {
    const result = match(candidates[i], value)
    if (result != null) {
      return result
    }
  }
  return undefined
}

function findClosestMatch<T, R>(
  candidates: ReadonlyArray<T>,
  match: (candidate: T, value: unknown) => R | null | undefined,
  value: unknown,
  minPossibleDistance: number
): R | undefined {
  const prevDistance = subclassDistance
  let best: R | undefined
  let bestDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i < candidates.length; i++) {
    subclassDistance = 0
    const result = match(candidates[i], value)
    if (result != null && subclassDistance < bestDistance) {
      best = result
      bestDistance = subclassDistance
      if (bestDistance <= minPossibleDistance) {
        break
      }
    }
  }

  subclassDistance = prevDistance + (best != null ? bestDistance : 0)
  return best
}
