import { computed, IArrayDidChange, type IComputedValue, IObjectDidChange, observe } from "mobx"
import type { Path } from "../parent/pathTypes"
import { isTweakedObject } from "../tweaker/core"
import type { TypeCheckError } from "./TypeCheckError"

/**
 * @internal
 *
 * Per-entry cache map type used by `createPerEntryCachedCheck`.
 */
export type PerEntryCache = Map<PropertyKey, IComputedValue<TypeCheckError | null>>

/**
 * @internal
 *
 * Callback that sets up reactive pruning of stale per-entry cache entries.
 * Called once per observable value when the aggregation is first created.
 * Should install an observe listener that removes entries from the cache
 * when the collection structure changes (e.g. key removal, array shrink).
 */
export type CachePruningSetup = (value: any, capturedEntries: PerEntryCache) => void

/**
 * @internal
 *
 * Pruning strategy for record / plain-object types.
 * Removes a per-entry cached computed when an object key is removed.
 */
export const recordCachePruning: CachePruningSetup = (value, capturedEntries) => {
  observe(value, (change: IObjectDidChange) => {
    if (change.type === "remove") {
      capturedEntries.delete(change.name)
    }
  })
}

/**
 * @internal
 *
 * Pruning strategy for array types.
 * After a splice that shrinks the array, removes per-entry cached computeds
 * for indices that no longer exist (i.e. index >= newLength).
 */
export const arrayCachePruning: CachePruningSetup = (value, capturedEntries) => {
  observe(value, (change: IArrayDidChange) => {
    if (change.type === "splice") {
      const newLength = (value as unknown[]).length
      if (capturedEntries.size > newLength) {
        for (const key of capturedEntries.keys()) {
          if ((key as number) >= newLength) {
            capturedEntries.delete(key)
          }
        }
      }
    }
  })
}

/**
 * @internal
 *
 * Debug registry mapping observable values to their per-entry cache Maps.
 * Used by tests to verify that stale entries are actually pruned.
 */
const __debugPerEntryCaches = new WeakMap<object, PerEntryCache>()

/**
 * @internal
 *
 * Returns the number of entries in the per-entry cache for the given observable value,
 * or `undefined` if the value has no cached entries. Used by tests to verify pruning.
 */
export function __getPerEntryCacheSize(value: object): number | undefined {
  return __debugPerEntryCaches.get(value)?.size
}

/**
 * @internal
 *
 * Creates a check function that uses per-entry MobX computeds + an aggregation computed
 * for fine-grained reactive type checking.
 *
 * For tweaked (observable) values:
 * 1. Per-entry computeds — each reads only one entry's observable, so changing entry A
 *    only invalidates entry A's computed.
 * 2. Aggregation computed — iterates per-entry computeds. Thanks to MobX's change propagation,
 *    if a per-entry computed re-evaluates but returns the same result (e.g. null → null),
 *    the aggregation body is skipped entirely.
 * 3. Stale entries are pruned reactively via an optional `setupCachePruning` callback
 *    (e.g. MobX `observe` listener) that fires on structural mutations, preventing
 *    memory leaks for dynamic collections.
 *
 * For non-tweaked values (plain snapshots), falls back to imperative checking.
 *
 * @param iterateEntries Called both inside the aggregation computed (cached path) and
 *   for the imperative fallback. Receives a `checkEntry(key)` callback that either
 *   returns a cached computed result or performs a direct check, depending on the path.
 *   Should call `checkEntry(key)` for each entry and return the first error, or null.
 * @param checkEntry Checks a single entry. For tweaked values, the utility wraps this
 *   in a non-keepAlive computed automatically. For non-tweaked values, called directly.
 * @param setupCachePruning Optional callback to install reactive pruning of stale entries.
 *   Called once per observable value. Use `recordCachePruning` for records/objects,
 *   `arrayCachePruning` for arrays, or omit for fixed-schema types (objects, tuples).
 */
export function createPerEntryCachedCheck<K extends PropertyKey>(
  iterateEntries: (
    value: any,
    checkEntry: (entryKey: K) => TypeCheckError | null
  ) => TypeCheckError | null,
  checkEntry: (value: any, entryKey: K, path: Path, typeCheckedValue: any) => TypeCheckError | null,
  setupCachePruning?: CachePruningSetup
): (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null {
  const perEntryCache = new WeakMap<object, PerEntryCache>()
  const aggregationCache = new WeakMap<object, IComputedValue<TypeCheckError | null>>()

  // Mutable call context updated before each `.get()` so computed closures
  // always use the latest path/typeCheckedValue. Safe because MobX computed
  // evaluation is synchronous and single-threaded.
  let currentPath: Path
  let currentTypeCheckedValue: any

  return (value: any, path: Path, typeCheckedValue: any): TypeCheckError | null => {
    if (!isTweakedObject(value, true)) {
      return iterateEntries(value, (key) => checkEntry(value, key, path, typeCheckedValue))
    }

    // Update mutable scope before evaluation.
    currentPath = path
    currentTypeCheckedValue = typeCheckedValue

    let aggr = aggregationCache.get(value)
    if (!aggr) {
      let entries = perEntryCache.get(value)
      if (!entries) {
        entries = new Map()
        perEntryCache.set(value, entries)
        __debugPerEntryCaches.set(value, entries)
      }

      const capturedEntries = entries

      // Install reactive pruning if a strategy was provided.
      setupCachePruning?.(value, capturedEntries)

      const cachedCheckEntry = (key: K): TypeCheckError | null => {
        let c = capturedEntries.get(key)
        if (!c) {
          c = computed(() => checkEntry(value, key, currentPath, currentTypeCheckedValue))
          capturedEntries.set(key, c)
        }
        return c.get()
      }

      aggr = computed(() => iterateEntries(value, cachedCheckEntry), { keepAlive: true })
      aggregationCache.set(value, aggr)
    }

    return aggr.get()
  }
}
