import {
  computed,
  createAtom,
  type IArrayDidChange,
  type IComputedValue,
  type IObjectDidChange,
  isObservableObject,
  keys,
  transaction,
  untracked,
} from "mobx"
import { dataToModelNode, modelToDataNode } from "../parent/core"
import { fastGetParent, fastGetParentPath } from "../parent/path"
import type { Path, PathElement } from "../parent/pathTypes"
import { isTweakedObject } from "../tweaker/core"
import {
  addTweakedChangeListener,
  type TweakedChangeListener,
} from "../tweaker/tweakedChangeListeners"
import { getMobxVersion } from "../utils"
import { ChunkedSequence, ChunkedSet, chunkSize, type SequenceChunk } from "../utils/chunks"
import { getOrCreate } from "../utils/mapUtils"
import { TypeCheckError } from "./TypeCheckError"

/**
 * Containers whose cached checks may be stale, each with its child on the way
 * to the changed object (undefined for the changed object itself, and null
 * when there are several).
 */
let uncachedTypeCheckObjects: Map<object, object | undefined | null> | undefined

/**
 * Context-free results of the uncached checks of those containers, by checker.
 * Every typed ancestor of the changed object checks the path to it again, so
 * without them a change would be checked in O(depth²).
 */
let uncachedResults: Map<object, Map<object, TypeCheckError | null>> | undefined

/** @internal */
export function withoutCachedTypeChecking(obj: object, fn: () => void): void {
  const previous = uncachedTypeCheckObjects
  const affected = new Map(previous)
  const add = (node: object, child: object | undefined) => {
    affected.set(node, affected.has(node) && affected.get(node) !== child ? null : child)
  }
  // Only these containers can retain a cached result for the old shape.
  // Model schema checks run on $ data, while refinements can check the model.
  let child: object | undefined
  let current: object | undefined = dataToModelNode(obj)
  while (current) {
    add(current, child)
    const data: object = modelToDataNode(current)
    if (data !== current) {
      add(data, child)
    }
    child = current
    current = fastGetParent(current, false)
  }
  const previousResults = uncachedResults
  uncachedTypeCheckObjects = affected
  uncachedResults = new Map()
  try {
    fn()
  } finally {
    uncachedTypeCheckObjects = previous
    uncachedResults = previousResults
    // the tree changed again, so the outer results may be stale
    previousResults?.clear()
  }
}

/**
 * Runs the uncached, context-free check of a container once per
 * `withoutCachedTypeChecking` call, and contextualizes its result.
 */
function checkUncached(
  checker: object,
  value: object,
  path: Path,
  typeCheckedValue: any,
  check: () => TypeCheckError | null
): TypeCheckError | null {
  const results = getOrCreate(uncachedResults!, checker, () => new Map())
  let error = results.get(value)
  if (error === undefined) {
    error = check()
    results.set(value, error)
  }
  return contextualizeCachedError(error, path, typeCheckedValue)
}

const emptyPath: Path = []

/** Key or index of a child in its parent, or undefined when it is not its child. */
function getChildKey(parent: object, child: object): PathElement | undefined {
  const parentPath = fastGetParentPath(child, false)
  return parentPath?.parent === parent ? parentPath.path : undefined
}

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
    modelTrail: error.modelTrail,
    expectedTypeName: error.expectedTypeName,
    actualValue: error.actualValue,
    typeCheckedValue,
  })
}

type CachedEntry = IComputedValue<TypeCheckError | null>

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
    if (uncachedTypeCheckObjects?.has(value)) {
      return checkUncached(cache, value, path, typeCheckedValue, () =>
        check(value, emptyPath, undefined)
      )
    }

    const cached = getOrCreate(cache, value, () =>
      computed(() => check(value, emptyPath, undefined), { keepAlive: true })
    )
    const error = cached.get()
    return contextualizeCachedError(error, path, typeCheckedValue)
  }
}

// MobX 6+ batches while tracking a derivation. MobX < 6 does not, and computes
// unobserved computeds read outside a batch without caching them, which would
// check new chunks twice.
const needsBatchToCacheChunks = getMobxVersion() < 6

function checkChunks<T>(fn: () => T): T {
  return needsBatchToCacheChunks ? transaction(fn) : fn()
}

/**
 * Checks the items of an array, starting at `firstIndex`, and returns the first
 * error, or null.
 *
 * @internal
 */
export type CheckArrayItems = (
  items: ArrayLike<unknown>,
  firstIndex: number,
  path: Path,
  typeCheckedValue: any
) => TypeCheckError | null

class ArrayChunk {
  items: unknown[]
  /** Changed when the items change. */
  readonly atom = createAtom("arrayTypeCheckChunk")
  readonly check: IComputedValue<TypeCheckError | null>

  constructor(items: unknown[], checkItems: CheckArrayItems) {
    this.items = items
    // error indexes are relative to the chunk, so moving it keeps its result
    this.check = computed(() => {
      this.atom.reportObserved()
      return checkItems(this.items, 0, emptyPath, undefined)
    })
  }
}

/**
 * The items of an array split in chunks, kept up to date through the array
 * changes.
 */
class ArrayChunks
  extends ChunkedSequence<unknown, ArrayChunk>
  implements TweakedChangeListener<IArrayDidChange>
{
  /** Changed when chunks are resized, since error indexes depend on their sizes. */
  readonly atom = createAtom("arrayTypeCheckChunks")
  private readonly array: readonly unknown[]
  private readonly checkItems: CheckArrayItems

  constructor(array: readonly unknown[], checkItems: CheckArrayItems) {
    super()
    this.array = array
    this.checkItems = checkItems
    this.appendChunks(untracked(() => array.slice()))
  }

  resync() {
    this.reset(untracked(() => this.array.slice()))
    this.atom.reportChanged()
  }

  /**
   * Returns the first error. When given, the chunk with the item at
   * `uncachedIndex` is checked without using its cached result.
   */
  check(uncachedIndex?: number): TypeCheckError | null {
    let uncached = -1
    if (uncachedIndex === undefined) {
      this.atom.reportObserved()
    } else {
      uncached = this.locate(uncachedIndex)[0]
    }
    let offset = 0
    for (let c = 0; c < this.chunks.length; c++) {
      const chunk = this.chunks[c]
      const error =
        c === uncached ? this.checkItems(chunk.items, 0, emptyPath, undefined) : chunk.check.get()
      if (error) {
        return offset === 0 ? error : offsetErrorIndex(error, offset)
      }
      offset += chunk.items.length
    }
    return null
  }

  applyChange(change: IArrayDidChange) {
    if (change.type === "update") {
      const [c, offset] = this.locate(change.index)
      const chunk = this.chunks[c]
      chunk.items[offset] = change.newValue
      chunk.atom.reportChanged()
    } else {
      this.splice(change.index, change.removedCount, change.added)
      this.atom.reportChanged()
    }
  }

  protected createChunk(items: unknown[]): ArrayChunk {
    return new ArrayChunk(items, this.checkItems)
  }

  protected onSpliced(chunk: ArrayChunk): void {
    chunk.atom.reportChanged()
  }

  protected onItemsMoved(chunk: ArrayChunk): void {
    chunk.atom.reportChanged()
  }
}

function offsetErrorIndex(error: TypeCheckError, offset: number): TypeCheckError {
  return new TypeCheckError({
    path: [(error.path[0] as number) + offset, ...error.path.slice(1)],
    modelTrail: error.modelTrail,
    expectedTypeName: error.expectedTypeName,
    actualValue: error.actualValue,
    typeCheckedValue: error.typeCheckedValue,
  })
}

class RecordChunk implements SequenceChunk<string> {
  items: string[]
  /** Changed when its keys change. */
  readonly atom = createAtom("recordTypeCheckChunk")
  readonly check: IComputedValue<TypeCheckError | null>

  constructor(
    keys: string[],
    checkKey: (key: string) => TypeCheckError | null,
    getEntry: (key: string) => CachedEntry
  ) {
    this.items = keys
    let isFirstEvaluation = true
    const checkKeys = (): TypeCheckError | null => {
      this.atom.reportObserved()
      const keys = this.items
      // the first check does not allocate per-entry state, and later ones only
      // re-check the entries that changed
      const check = isFirstEvaluation ? checkKey : (key: string) => getEntry(key).get()
      isFirstEvaluation = false
      for (let i = 0; i < keys.length; i++) {
        const error = check(keys[i])
        if (error) {
          return error
        }
      }
      return null
    }
    // (the entries would not be cached otherwise when MobX < 6 checks whether
    // this chunk changed outside a batch)
    this.check = computed(needsBatchToCacheChunks ? () => transaction(checkKeys) : checkKeys)
  }
}

/**
 * The keys of a record split in chunks, kept up to date through the record
 * changes.
 */
class RecordChunks
  extends ChunkedSet<string, RecordChunk>
  implements TweakedChangeListener<IObjectDidChange>
{
  /** Check of each entry, created once its chunk is checked again. */
  private readonly entries = new Map<string, CachedEntry>()
  /** Changed when chunks are added or removed. */
  readonly atom = createAtom("recordTypeCheckChunks")
  private readonly record: object
  private readonly checkKey: (key: string) => TypeCheckError | null
  private readonly getEntry = (key: string): CachedEntry =>
    getOrCreate(this.entries, key, () => computed(() => this.checkKey(key)))

  constructor(record: object, checkKey: (key: string) => TypeCheckError | null) {
    super()
    this.record = record
    this.checkKey = checkKey
    this.appendChunks(untracked(() => keys(record) as string[]))
  }

  resync() {
    this.entries.clear()
    this.reset(untracked(() => keys(this.record) as string[]))
    this.atom.reportChanged()
  }

  /**
   * Whether any entry has an error. When given, the entry of `uncachedKey` is
   * checked without using its cached result.
   */
  hasError(uncachedKey?: string): boolean {
    let uncached: RecordChunk | undefined
    if (uncachedKey === undefined) {
      this.atom.reportObserved()
    } else {
      uncached = this.getChunkOf(uncachedKey)
    }
    for (const chunk of this.chunks) {
      if (chunk !== uncached) {
        if (chunk.check.get()) {
          return true
        }
        continue
      }
      for (const k of chunk.items) {
        if (k === uncachedKey ? this.checkKey(k) : this.getEntry(k).get()) {
          return true
        }
      }
    }
    return false
  }

  applyChange(change: IObjectDidChange) {
    const key = change.name
    if (typeof key !== "string") {
      return
    }
    // value updates invalidate the chunk reading them
    if (change.type === "add") {
      this.add(key)
    } else if (change.type === "remove") {
      this.entries.delete(key)
      this.delete(key)
    }
  }

  protected createChunk(keys: string[]) {
    return new RecordChunk(keys, this.checkKey, this.getEntry)
  }

  protected onChunkChanged(chunk: RecordChunk): void {
    chunk.atom.reportChanged()
  }

  protected onChunksChanged(): void {
    this.atom.reportChanged()
  }
}

/**
 * Cached check for the values of a record.
 *
 * A single computed over every entry would make MobX revalidate every entry on
 * each change, so the keys are split in chunks, each with its own computed, kept
 * up to date from the record changes. A change then only revalidates one chunk
 * and the chunk results. Once a chunk is invalidated each of its entries gets
 * its own computed, so a value change only re-checks that value.
 *
 * Chunks are not in the order the keys are iterated in, so when a chunk has an
 * error the first error is found by checking every entry again in order.
 *
 * The chunks learn about added and removed keys before the checks after that
 * change run, and read values rather than keys, so unlike other cached checks
 * this one stays valid while MobX has yet to invalidate the readers of the
 * record keys (see `withoutCachedTypeChecking`). When the keys of an object
 * below an entry change instead, only the check of that entry is stale, so
 * only it is checked again without its cache.
 *
 * Cached checks produce context-free errors, which are contextualized with the
 * current path and checked root without running the checks again. Values that
 * are not tweaked (plain snapshots) are checked directly.
 *
 * @internal
 *
 * @param iterateEntries Iterates the keys in order and returns the first error, or null.
 * @param checkEntry Checks a single entry.
 */
export function createChunkedRecordCachedCheck(
  iterateEntries: IterateEntries<PropertyKey>,
  checkEntry: CheckEntry<PropertyKey>
): (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null {
  const cache = new WeakMap<
    object,
    { readonly chunks: RecordChunks; readonly check: IComputedValue<TypeCheckError | null> }
  >()

  const checkAllEntries = (value: any, path: Path, typeCheckedValue: any) =>
    iterateEntries(value, (key) => checkEntry(value, key, path, typeCheckedValue))

  return (value, path, typeCheckedValue) => {
    // only tweaked plain objects notify the chunks of their key changes
    if (!isTweakedObject(value, true) || !isObservableObject(value)) {
      return checkAllEntries(value, path, typeCheckedValue)
    }

    let cached = cache.get(value)
    const uncachedChild = uncachedTypeCheckObjects?.get(value)
    if (uncachedChild !== undefined) {
      // an entry (or something below it) has a stale cached check
      const key = uncachedChild && getChildKey(value, uncachedChild)
      const chunks = cached?.chunks
      return checkUncached(cache, value, path, typeCheckedValue, () => {
        if (chunks && typeof key === "string") {
          if (!checkChunks(() => chunks.hasError(key))) {
            return null
          }
        }
        return checkAllEntries(value, emptyPath, undefined)
      })
    }

    if (!cached) {
      // keys already include a change being notified
      const chunks = new RecordChunks(value, (key) => checkEntry(value, key, emptyPath, undefined))
      addTweakedChangeListener<object>(value, chunks)
      const check = computed(
        () => {
          // any added or removed key changes a chunk, so this runs again then
          return checkChunks(() => chunks.hasError())
            ? checkAllEntries(value, emptyPath, undefined)
            : null
        },
        { keepAlive: true }
      )
      cached = { chunks, check }
      cache.set(value, cached)
    }

    return contextualizeCachedError(cached.check.get(), path, typeCheckedValue)
  }
}

/**
 * Cached check for the items of an array.
 *
 * MobX invalidates array reads at collection granularity, so one computed per
 * item does not help. A single computed over all the items is O(n) on every
 * change though: a push re-reads every item check, and a change inside one item
 * makes MobX revalidate every item check the computed depends on.
 *
 * Instead, once an array grows large its items are split into chunks, each with
 * its own computed over a plain copy of its items, which are kept up to date
 * from the array changes rather than by reading the array. An item change
 * revalidates one chunk, and a splice re-checks only the chunks it touched.
 * Chunk errors use indexes relative to their chunk, so inserting items does not
 * invalidate the chunks after it.
 *
 * When the keys of an object below an item change, only the chunk of that item
 * is checked again without its cache (see `withoutCachedTypeChecking`).
 *
 * @internal
 */
export function createChunkedArrayCachedCheck(
  checkItems: CheckArrayItems
): (value: any, path: Path, typeCheckedValue: any) => TypeCheckError | null {
  const cache = new WeakMap<
    object,
    { chunks: ArrayChunks | undefined; readonly check: IComputedValue<TypeCheckError | null> }
  >()

  return (value, path, typeCheckedValue) => {
    const array: readonly unknown[] = value
    if (!isTweakedObject(array, true)) {
      return checkItems(array, 0, path, typeCheckedValue)
    }

    let cached = cache.get(array)
    const uncachedChild = uncachedTypeCheckObjects?.get(array)
    if (uncachedChild !== undefined) {
      // an item (or something below it) has a stale cached check
      const index = uncachedChild && getChildKey(array, uncachedChild)
      const chunks = cached?.chunks
      return checkUncached(cache, array, path, typeCheckedValue, () => {
        if (!chunks || typeof index !== "number") {
          return checkItems(array, 0, emptyPath, undefined)
        }
        return checkChunks(() => chunks.check(index))
      })
    }

    if (!cached) {
      const state: {
        chunks: ArrayChunks | undefined
        readonly check: IComputedValue<TypeCheckError | null>
      } = {
        chunks: undefined,
        check: computed(
          () => {
            if (!state.chunks) {
              if (array.length <= chunkSize) {
                return checkItems(array, 0, emptyPath, undefined)
              }
              // from now on the chunks follow the array changes, so the array
              // is no longer read
              const newChunks = new ArrayChunks(array, checkItems)
              addTweakedChangeListener(array, newChunks)
              state.chunks = newChunks
            }

            const chunks = state.chunks
            return checkChunks(() => chunks.check())
          },
          { keepAlive: true }
        ),
      }
      cached = state
      cache.set(array, cached)
    }

    return contextualizeCachedError(cached.check.get(), path, typeCheckedValue)
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
  const aggregationCache = new WeakMap<object, IComputedValue<TypeCheckError | null>>()

  const checkAllEntries = (value: any, path: Path, typeCheckedValue: any) =>
    iterateEntries(value, (key) => checkEntry(value, key, path, typeCheckedValue))

  return (value, path, typeCheckedValue) => {
    if (!isTweakedObject(value, true)) {
      return checkAllEntries(value, path, typeCheckedValue)
    }
    if (uncachedTypeCheckObjects?.has(value)) {
      return checkUncached(aggregationCache, value, path, typeCheckedValue, () =>
        checkAllEntries(value, emptyPath, undefined)
      )
    }

    let aggregation = aggregationCache.get(value)
    if (!aggregation) {
      let entries: Array<CachedEntry | undefined> | undefined
      let isFirstEvaluation = true
      const cachedCheckEntry = (index: number): TypeCheckError | null => {
        entries ??= []
        let entry = entries[index]
        if (!entry) {
          entry = computed(() => checkEntry(value, index, emptyPath, undefined))
          entries[index] = entry
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
