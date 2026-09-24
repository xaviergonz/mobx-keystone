import { createAtom, type IAtom } from "mobx"
import { treeNodeMetadata } from "../tweaker/treeNodeMetadata"
import { isPrimitive } from "../utils"
import { ChunkedSequence, chunkSize, type SequenceChunk } from "../utils/chunks"
import { reportParentPathChanged } from "./core"
import type { ParentPath } from "./path"

/** Arrays whose splices would reindex more children than this switch to lazy indexes. */
const lazyIndexesThreshold = 1024

class PathChunk implements SequenceChunk<LazyArrayParentPath | undefined> {
  /** Path of each item, or undefined for primitives. */
  items: (LazyArrayParentPath | undefined)[]
  offset = 0
  /**
   * Changed when the index of any of its items changes, or when items move
   * out of it, so observers of their paths follow them to their new chunk.
   */
  readonly atom: IAtom = createAtom("arrayPathChunk")
  readonly owner: ArrayPaths

  constructor(owner: ArrayPaths, items: (LazyArrayParentPath | undefined)[]) {
    this.owner = owner
    this.items = items
  }
}

/**
 * Parent path of an item of a large array. Its index is the offset of its chunk
 * plus its position within it, so a splice only renumbers one chunk and moves
 * the offsets of the chunks after it, instead of reindexing every item after it.
 * Once removed, it keeps the index it had.
 *
 * @internal
 */
export class LazyArrayParentPath implements ParentPath<object> {
  // declared rather than defined fields: there are as many instances as array
  // items, and defined fields compile to an Object.defineProperty call each
  declare readonly parent: object
  /** Undefined once removed from the array. */
  declare chunk: PathChunk | undefined
  /** Position within the chunk, or the final index once removed. */
  declare local: number

  constructor(parent: object, chunk: PathChunk, local: number) {
    this.parent = parent
    this.chunk = chunk
    this.local = local
  }

  get path(): number {
    const chunk = this.chunk
    if (!chunk) {
      return this.local
    }
    chunk.owner.updateOffsets()
    return chunk.offset + this.local
  }

  /**
   * An immutable copy for callers outside the library, which may keep it,
   * reused while the index stays the same.
   */
  toParentPath(): ParentPath<object> {
    const path = this.path
    let publicPath = publicPaths.get(this)
    if (publicPath?.path !== path) {
      publicPath = { parent: this.parent, path }
      publicPaths.set(this, publicPath)
    }
    return publicPath
  }

  /** Makes observers of this path also react to index changes. */
  reportObserved(): void {
    this.chunk?.atom.reportObserved()
  }
}

// kept apart, since few paths are ever handed out
const publicPaths = new WeakMap<LazyArrayParentPath, ParentPath<object>>()

class ArrayPaths extends ChunkedSequence<LazyArrayParentPath | undefined, PathChunk> {
  readonly array: readonly unknown[]
  private offsetsDirty = false

  constructor(array: readonly unknown[]) {
    super()
    this.array = array
    const length = array.length
    for (let start = 0; start < length; start += chunkSize) {
      // a slice is much faster than indexed reads through an observable array
      const items = array.slice(start, start + chunkSize)
      const chunk = new PathChunk(this, new Array(items.length))
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!isPrimitive(item)) {
          const entry = new LazyArrayParentPath(array, chunk, i)
          chunk.items[i] = entry
          treeNodeMetadata.get(item as object)!.parentPath = entry
          // current observers of its path do not observe its chunk yet
          reportParentPathChanged(item as object)
        }
      }
      this.chunks.push(chunk)
    }
    this.offsetsDirty = true
  }

  updateOffsets(): void {
    if (!this.offsetsDirty) {
      return
    }
    this.offsetsDirty = false
    let offset = 0
    for (const chunk of this.chunks) {
      chunk.offset = offset
      offset += chunk.items.length
    }
  }

  /**
   * Paths for values to be inserted at an index, undefined for primitives. They
   * already resolve to their final index, but are only added by `splice`, so
   * attaching the values can fail without leaving them behind.
   */
  createPaths(index: number, values: readonly unknown[]): (LazyArrayParentPath | undefined)[] {
    this.updateOffsets()
    if (this.chunks.length === 0) {
      this.chunks.push(this.createChunk([]))
    }
    const [c, start] = this.locate(index)
    const chunk = this.chunks[c]
    const paths: (LazyArrayParentPath | undefined)[] = new Array(values.length)
    for (let i = 0; i < values.length; i++) {
      if (!isPrimitive(values[i])) {
        paths[i] = new LazyArrayParentPath(this.array, chunk, start + i)
      }
    }
    return paths
  }

  /** Applies a splice, freezing the removed paths and adding ones from `createPaths`. */
  applySplice(
    index: number,
    removedCount: number,
    addedPaths: (LazyArrayParentPath | undefined)[]
  ): void {
    this.updateOffsets()
    this.splice(index, removedCount, addedPaths, freezeRemovedPath)
    this.offsetsDirty = true
  }

  /** Replaces the path of an updated item, freezing the old one. */
  set(index: number, value: unknown): LazyArrayParentPath | undefined {
    this.updateOffsets()
    const [c, local] = this.locate(index)
    const chunk = this.chunks[c]
    const old = chunk.items[local]
    if (old) {
      freezeRemovedPath(old, chunk, local)
    }
    const entry = isPrimitive(value) ? undefined : new LazyArrayParentPath(this.array, chunk, local)
    chunk.items[local] = entry
    return entry
  }

  protected createChunk(items: (LazyArrayParentPath | undefined)[]): PathChunk {
    return new PathChunk(this, items)
  }

  protected onSpliced(chunk: PathChunk, from: number): void {
    // the items after the splice moved within the chunk, and may move to other
    // chunks when it is resized, where observers will follow them
    renumber(chunk, from)
    chunk.atom.reportChanged()
  }

  protected onItemsMoved(chunk: PathChunk, from: number): void {
    renumber(chunk, from)
  }

  protected onShifted(chunk: PathChunk): void {
    // the index of every item after the splice changed
    chunk.atom.reportChanged()
  }
}

function freezeRemovedPath(
  entry: LazyArrayParentPath | undefined,
  chunk: PathChunk,
  local: number
): void {
  if (entry) {
    entry.local = chunk.offset + local
    entry.chunk = undefined
  }
}

function renumber(chunk: PathChunk, from: number): void {
  const items = chunk.items
  for (let i = from; i < items.length; i++) {
    const entry = items[i]
    if (entry) {
      entry.chunk = chunk
      entry.local = i
    }
  }
}

const arrayPaths = new WeakMap<object, ArrayPaths>()

/**
 * Lazy indexes of an array, created once a splice would reindex many of its
 * items.
 *
 * @internal
 */
export function getArrayPaths(
  array: readonly unknown[],
  reindexedCount: number
): ArrayPaths | undefined {
  let paths = arrayPaths.get(array)
  if (!paths && reindexedCount > lazyIndexesThreshold) {
    paths = new ArrayPaths(array)
    arrayPaths.set(array, paths)
  }
  return paths
}

/**
 * Makes an attached value use its lazy path, even if it was attached with an
 * equal one.
 *
 * @internal
 */
export function setLazyArrayParentPath(entry: LazyArrayParentPath, node: object): void {
  const metadata = treeNodeMetadata.get(node)!
  if (metadata.parentPath !== entry) {
    metadata.parentPath = entry
  }
}
