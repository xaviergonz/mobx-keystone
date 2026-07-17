import { computed, type IComputedValue, type IObjectDidChange, observe } from "mobx"
import type { Path } from "../parent/pathTypes"
import { isTweakedObject } from "../tweaker/core"
import { TypeCheckError } from "./TypeCheckError"

const emptyPath: Path = []

function contextualizeCachedError(
  error: TypeCheckError | null,
  path: Path,
  typeCheckedValue: any
): TypeCheckError | null {
  if (!error) {
    return null
  }

  return new TypeCheckError({
    path: [...path, ...error.path],
    expectedTypeName: error.expectedTypeName,
    actualValue: error.actualValue,
    typeCheckedValue,
  })
}

type CachedEntry = IComputedValue<TypeCheckError | null>

interface EntryCache<K> {
  get(key: K): CachedEntry | undefined
  set(key: K, entry: CachedEntry): void
}

type IterateEntries<K> = (
  value: any,
  checkEntry: (entryKey: K) => TypeCheckError | null
) => TypeCheckError | null

type CheckEntry<K> = (
  value: any,
  entryKey: K,
  path: Path,
  typeCheckedValue: any
) => TypeCheckError | null

function createAdaptivePerEntryCachedCheck<K>(
  iterateEntries: IterateEntries<K>,
  checkEntry: CheckEntry<K>,
  createEntryCache: (value: object) => EntryCache<K>
): (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null {
  const aggregationCache = new WeakMap<object, IComputedValue<TypeCheckError | null>>()

  const checkAllEntries = (value: any, path: Path, typeCheckedValue: any) =>
    iterateEntries(value, (key) => checkEntry(value, key, path, typeCheckedValue))

  return (value, path, typeCheckedValue) => {
    if (!isTweakedObject(value, true)) {
      return checkAllEntries(value, path, typeCheckedValue)
    }

    let aggregation = aggregationCache.get(value)
    if (!aggregation) {
      let entries: EntryCache<K> | undefined
      let isFirstEvaluation = true
      const cachedCheckEntry = (key: K): TypeCheckError | null => {
        if (!entries) {
          entries = createEntryCache(value)
        }

        let entry = entries.get(key)
        if (!entry) {
          entry = computed(() => checkEntry(value, key, emptyPath, undefined))
          entries.set(key, entry)
        }
        return entry.get()
      }

      aggregation = computed(
        () => {
          if (isFirstEvaluation) {
            isFirstEvaluation = false
            return checkAllEntries(value, emptyPath, undefined)
          }
          return iterateEntries(value, cachedCheckEntry)
        },
        { keepAlive: true }
      )
      aggregationCache.set(value, aggregation)
    }

    return contextualizeCachedError(aggregation.get(), path, typeCheckedValue)
  }
}

/**
 * @internal
 *
 * Creates an adaptive check for dynamic records.
 *
 * For tweaked (observable) values:
 * 1. The first complete check is cached without allocating per-entry state.
 * 2. After the first invalidation, per-entry computeds each read one property, so
 *    changing property A only invalidates property A's computed.
 * 3. The aggregation computed iterates per-entry computeds. Thanks to MobX's propagation,
 *    if a per-entry computed re-evaluates but returns the same result (e.g. null → null),
 *    the aggregation body is skipped entirely.
 * 4. A pruning observer is installed when the promoted entry cache is first used
 *    and removes stale entries immediately when record keys are deleted.
 *
 * Cached checks produce context-free errors. A fresh error is contextualized
 * with the current path and checked root without executing user checkers again.
 *
 * For non-tweaked values (plain snapshots), the entry iterator and checker run
 * directly with the caller's context.
 *
 * @param iterateEntries Iterates the promoted per-entry computeds and returns
 *   the first error, or null.
 * @param checkEntry Checks a single entry. The utility wraps it in a
 *   non-keepAlive computed automatically after promotion.
 */
export function createAdaptiveRecordCachedCheck(
  iterateEntries: IterateEntries<PropertyKey>,
  checkEntry: CheckEntry<PropertyKey>
): (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null {
  return createAdaptivePerEntryCachedCheck(iterateEntries, checkEntry, (value) => {
    const entries = new Map<PropertyKey, CachedEntry>()
    observe(value, (change: IObjectDidChange) => {
      if (change.type === "remove") {
        entries.delete(change.name)
      }
    })
    return entries
  })
}

/**
 * Creates one reactive computed for a complete container check.
 *
 * @internal
 */
export function createWholeContainerCachedCheck(
  check: (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null
): (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null {
  const cache = new WeakMap<object, IComputedValue<TypeCheckError | null>>()

  return (value, path, typeCheckedValue) => {
    if (!isTweakedObject(value, true)) {
      return check(value, path, typeCheckedValue)
    }

    let cached = cache.get(value)
    if (!cached) {
      cached = computed(() => check(value, emptyPath, undefined), { keepAlive: true })
      cache.set(value, cached)
    }
    const error = cached.get()
    return contextualizeCachedError(error, path, typeCheckedValue)
  }
}

/**
 * Fixed-schema per-entry cache. Numeric entry keys use
 * array slots, and the aggregation closure owns that array, so only one
 * WeakMap is needed for each checked object. The aggregation caches one
 * complete check first and promotes itself to per-entry computeds after its
 * first dependency invalidation.
 *
 * @internal
 */
export function createIndexedPerEntryCachedCheck(
  iterateEntries: IterateEntries<number>,
  checkEntry: CheckEntry<number>
): (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null {
  return createAdaptivePerEntryCachedCheck(iterateEntries, checkEntry, () => {
    const entries: Array<CachedEntry | undefined> = []
    return {
      get: (index) => entries[index],
      set: (index, entry) => {
        entries[index] = entry
      },
    }
  })
}
