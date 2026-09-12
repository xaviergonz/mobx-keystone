import { failure } from "./index"

// keys() need only return an iterator, not an iterable. Wrapping it in one also lets
// for-of close that iterator when a predicate exits early.
function keysOf<T>(set: ReadonlySetLike<T>): Iterable<T> {
  return { [Symbol.iterator]: () => set.keys() }
}

// Read these once, in protocol order, even when a size check can decide the result.
function getSetRecord<T>(set: ReadonlySetLike<T>) {
  if ((typeof set !== "object" || set === null) && typeof set !== "function") {
    throw failure("expected a set-like object")
  }
  const numberSize = +set.size
  if (Number.isNaN(numberSize)) throw failure("set-like size must be a number")
  const size = Math.trunc(numberSize)
  if (size < 0) throw failure("set-like size must not be negative")
  const has = set.has
  if (typeof has !== "function") throw failure("set-like has must be a function")
  const keys = set.keys
  if (typeof keys !== "function") throw failure("set-like keys must be a function")
  return {
    size,
    has: (value: T) => has.call(set, value),
    keys: { [Symbol.iterator]: () => keys.call(set) } as Iterable<T>,
  }
}

/** @internal */
export function isSetLikeSubsetOf<T>(
  set: ReadonlySetLike<T>,
  other: ReadonlySetLike<unknown>
): boolean {
  const otherRecord = getSetRecord(other)
  if (set.size > otherRecord.size) return false
  for (const value of keysOf(set)) {
    if (!otherRecord.has(value)) return false
  }
  return true
}

/** @internal */
export function isSetLikeSupersetOf<T>(
  set: ReadonlySetLike<T>,
  other: ReadonlySetLike<unknown>
): boolean {
  const otherRecord = getSetRecord(other)
  if (set.size < otherRecord.size) return false
  for (const value of otherRecord.keys) {
    if (!set.has(value as T)) return false
  }
  return true
}

/** @internal */
export function isSetLikeDisjointFrom<T>(
  set: ReadonlySetLike<T>,
  other: ReadonlySetLike<unknown>
): boolean {
  const otherRecord = getSetRecord(other)
  if (set.size <= otherRecord.size) {
    for (const value of keysOf(set)) {
      if (otherRecord.has(value)) return false
    }
  } else {
    for (const value of otherRecord.keys) {
      if (set.has(value as T)) return false
    }
  }
  return true
}

/** @internal */
export function setLikeUnion<T, U>(set: ReadonlySetLike<T>, other: ReadonlySetLike<U>): Set<T | U> {
  const otherRecord = getSetRecord(other)
  const result = new Set<T | U>(keysOf(set))
  for (const value of otherRecord.keys) result.add(value)
  return result
}

/** @internal */
export function setLikeIntersection<T, U>(
  set: ReadonlySetLike<T>,
  other: ReadonlySetLike<U>
): Set<T & U> {
  const otherRecord = getSetRecord(other)
  const result = new Set<T & U>()
  if (set.size <= otherRecord.size) {
    for (const value of keysOf(set)) {
      if (otherRecord.has(value as unknown as U)) result.add(value as T & U)
    }
  } else {
    for (const value of otherRecord.keys) {
      if (set.has(value as unknown as T)) result.add(value as T & U)
    }
  }
  return result
}

/** @internal */
export function setLikeDifference<T>(
  set: ReadonlySetLike<T>,
  other: ReadonlySetLike<unknown>
): Set<T> {
  const otherRecord = getSetRecord(other)
  const result = new Set<T>()
  if (set.size <= otherRecord.size) {
    for (const value of keysOf(set)) {
      if (!otherRecord.has(value)) result.add(value)
    }
  } else {
    for (const value of keysOf(set)) result.add(value)
    for (const value of otherRecord.keys) result.delete(value as T)
  }
  return result
}

/** @internal */
export function setLikeSymmetricDifference<T, U>(
  set: ReadonlySetLike<T>,
  other: ReadonlySetLike<U>
): Set<T | U> {
  const otherRecord = getSetRecord(other)
  const result = new Set<T | U>(keysOf(set))
  // Remember keys already processed: duplicate keys must not toggle membership.
  // Use the decoded result's equality, just like the native Set result.
  const seen = new Set<U>()
  for (const value of otherRecord.keys) {
    if (seen.has(value)) continue
    seen.add(value)
    if (!result.delete(value)) result.add(value)
  }
  return result
}
