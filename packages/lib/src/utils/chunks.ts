/**
 * Target size of the chunks large collections are split in, so a change only
 * needs to revisit one chunk instead of every item.
 *
 * @internal
 */
export const chunkSize = 128

/**
 * @internal
 */
export interface SequenceChunk<T> {
  items: T[]
}

/**
 * An ordered sequence split in chunks, which splices keep near `chunkSize`:
 * chunks are split above twice that size and merged below a quarter of it.
 * Subclasses decide what a chunk keeps track of through the hooks.
 *
 * @internal
 */
export abstract class ChunkedSequence<T, C extends SequenceChunk<T>> {
  chunks: C[] = []

  protected abstract createChunk(items: T[]): C

  /**
   * Called once items were removed from or inserted into a chunk, before
   * resizing it. The items from `from` on changed their position in it.
   */
  protected abstract onSpliced(chunk: C, from: number): void

  /**
   * Called when a resize moves items to another chunk, starting at `from`.
   * The chunk they come from was already passed to `onSpliced`.
   */
  protected abstract onItemsMoved(chunk: C, from: number): void

  /** Called for each chunk after the spliced ones when a splice changes the length. */
  protected onShifted(_chunk: C): void {}

  /** Splits items in new chunks, appended to the current ones. */
  protected appendChunks(items: readonly T[]): void {
    for (let i = 0; i < items.length; i += chunkSize) {
      this.chunks.push(this.createChunk(items.slice(i, i + chunkSize)))
    }
  }

  /** Replaces every chunk with new ones for the items. */
  protected reset(items: readonly T[]): void {
    this.chunks = []
    this.appendChunks(items)
  }

  /** Chunk containing the index, and the index within it. Appends go to the last chunk. */
  locate(index: number): [number, number] {
    const chunks = this.chunks
    let c = 0
    let local = index
    while (c < chunks.length - 1 && local >= chunks[c].items.length) {
      local -= chunks[c].items.length
      c++
    }
    return [c, local]
  }

  /**
   * Removes and inserts items, like `Array.prototype.splice`. `onRemoved` is
   * called with each removed item, the chunk it was in and its index there.
   */
  protected splice(
    index: number,
    removedCount: number,
    added: readonly T[],
    onRemoved?: (item: T, chunk: C, local: number) => void
  ): void {
    const chunks = this.chunks
    if (chunks.length === 0) {
      if (added.length === 0) {
        return
      }
      chunks.push(this.createChunk([]))
    }

    const [first, start] = this.locate(index)
    let last = first
    let remaining = removedCount
    let local = start
    for (let c = first; remaining > 0; c++) {
      const chunk = chunks[c]
      const count = Math.min(remaining, chunk.items.length - local)
      const removed = chunk.items.splice(local, count)
      if (onRemoved) {
        for (let i = 0; i < removed.length; i++) {
          onRemoved(removed[i], chunk, local + i)
        }
      }
      remaining -= count
      local = 0
      last = c
    }

    const firstChunk = chunks[first]
    if (added.length > 0) {
      firstChunk.items = firstChunk.items
        .slice(0, start)
        .concat(added as T[], firstChunk.items.slice(start))
    }

    this.onSpliced(firstChunk, start + added.length)
    for (let c = first + 1; c <= last; c++) {
      this.onSpliced(chunks[c], 0)
    }
    if (added.length !== removedCount) {
      for (let c = last + 1; c < chunks.length; c++) {
        this.onShifted(chunks[c])
      }
    }

    // backwards, so merging or splitting a chunk does not move the ones left to visit
    for (let c = last; c >= first; c--) {
      this.resize(c)
    }
  }

  /** Splits, merges or drops a changed chunk to keep its size near the target. */
  private resize(c: number) {
    const chunks = this.chunks
    const chunk = chunks[c]
    const length = chunk.items.length

    if (length > 2 * chunkSize) {
      const pieceCount = Math.ceil(length / chunkSize)
      const pieceSize = Math.ceil(length / pieceCount)
      const pieces: C[] = []
      for (let i = pieceSize; i < length; i += pieceSize) {
        const piece = this.createChunk(chunk.items.slice(i, i + pieceSize))
        this.onItemsMoved(piece, 0)
        pieces.push(piece)
      }
      chunk.items = chunk.items.slice(0, pieceSize)
      this.chunks = chunks.slice(0, c + 1).concat(pieces, chunks.slice(c + 1))
    } else if (length < chunkSize / 4) {
      const previous = chunks[c - 1] as C | undefined
      const next = chunks[c + 1] as C | undefined
      if (previous && previous.items.length + length <= 2 * chunkSize) {
        const from = previous.items.length
        previous.items = previous.items.concat(chunk.items)
        this.onItemsMoved(previous, from)
        chunks.splice(c, 1)
      } else if (next && next.items.length + length <= 2 * chunkSize) {
        next.items = chunk.items.concat(next.items)
        this.onItemsMoved(next, 0)
        chunks.splice(c, 1)
      } else if (length === 0) {
        chunks.splice(c, 1)
      }
    }
  }
}

/**
 * An unordered set split in chunks. Items are added to the last chunk, and a
 * chunk left under a quarter of `chunkSize` by removals is merged into a
 * neighbor (or dropped once empty). Subclasses decide what a chunk keeps track
 * of through the hooks.
 *
 * @internal
 */
export abstract class ChunkedSet<T, C extends SequenceChunk<T>> {
  chunks: C[] = []
  /** Chunk of each item, only needed (and kept) once an item is looked up. */
  private chunkOf: Map<T, C> | undefined

  protected abstract createChunk(items: T[]): C

  /** Called when items were added to or removed from a chunk. */
  protected abstract onChunkChanged(chunk: C): void

  /** Called when chunks were added or removed. */
  protected abstract onChunksChanged(): void

  /** Called for a chunk removed after its items were moved to another one. */
  protected onChunkDropped(_chunk: C): void {}

  /** Splits items in new chunks, appended to the current ones. */
  protected appendChunks(items: readonly T[]): void {
    for (let i = 0; i < items.length; i += chunkSize) {
      this.chunks.push(this.createChunk(items.slice(i, i + chunkSize)))
    }
  }

  /** Replaces every chunk with new ones for the items. */
  protected reset(items: readonly T[]): void {
    this.chunks = []
    this.chunkOf = undefined
    this.appendChunks(items)
  }

  add(item: T): void {
    let chunk = this.chunks[this.chunks.length - 1] as C | undefined
    if (chunk && chunk.items.length < chunkSize) {
      chunk.items.push(item)
      this.onChunkChanged(chunk)
    } else {
      chunk = this.createChunk([item])
      this.chunks.push(chunk)
      this.onChunksChanged()
    }
    this.chunkOf?.set(item, chunk)
  }

  /** Chunk containing the item, if any. */
  getChunkOf(item: T): C | undefined {
    return this.getChunkOfMap().get(item)
  }

  private getChunkOfMap(): Map<T, C> {
    if (!this.chunkOf) {
      this.chunkOf = new Map()
      for (const chunk of this.chunks) {
        for (const i of chunk.items) {
          this.chunkOf.set(i, chunk)
        }
      }
    }
    return this.chunkOf
  }

  /** Returns false if the item was not in the set. */
  delete(item: T): boolean {
    const chunkOf = this.getChunkOfMap()
    const chunk = chunkOf.get(item)
    if (!chunk) {
      return false
    }
    chunkOf.delete(item)
    // (the order within a chunk does not matter, so the last item fills the gap)
    const items = chunk.items
    const last = items.pop()!
    if (last !== item) {
      items[items.lastIndexOf(item)] = last
    }
    this.onChunkChanged(chunk)
    if (chunk.items.length >= chunkSize / 4) {
      return true
    }

    // merge it into a neighbor, or drop it once empty
    const chunks = this.chunks
    const c = chunks.indexOf(chunk)
    if (chunk.items.length > 0) {
      const neighbor = [chunks[c - 1], chunks[c + 1]].find(
        (n) => n && n.items.length + chunk.items.length <= 2 * chunkSize
      )
      if (!neighbor) {
        return true
      }
      for (const i of chunk.items) {
        chunkOf.set(i, neighbor)
      }
      neighbor.items = neighbor.items.concat(chunk.items)
      this.onChunkChanged(neighbor)
    }
    chunks.splice(c, 1)
    this.onChunkDropped(chunk)
    this.onChunksChanged()
    return true
  }
}
