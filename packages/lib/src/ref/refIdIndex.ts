import { computed, createAtom, type IComputedValue, Reaction } from "mobx"
import {
  type DeepObjectChildrenExtensionAccessor,
  registerDeepObjectChildrenExtension,
} from "../parent/coreObjectChildren"
import { ChunkedSet, type SequenceChunk } from "../utils/chunks"
import { getOrCreate } from "../utils/mapUtils"
import { NodesById } from "./nodesById"

type GetId = (target: object) => string | undefined

/**
 * A group of nodes, with a computed map of their current ids, so an id change
 * only re-reads the ids of the nodes in its chunk.
 */
class IdChunk implements SequenceChunk<object> {
  items: object[]
  /** Changed when nodes are added or removed. */
  readonly atom = createAtom("refIdChunk")
  readonly ids: IComputedValue<Map<string, object | object[]>>
  /** Ids last copied to the index. */
  syncedIds: Map<string, object | object[]> | undefined

  constructor(nodes: object[], getId: GetId) {
    this.items = nodes
    this.ids = computed(() => {
      this.atom.reportObserved()
      const ids = new Map<string, object | object[]>()
      for (const node of this.items) {
        const id = getId(node)
        if (id === undefined) {
          continue
        }
        const existing = ids.get(id)
        if (existing === undefined) {
          ids.set(id, node)
        } else if (Array.isArray(existing)) {
          existing.push(node)
        } else {
          ids.set(id, [existing, node])
        }
      }
      return ids
    })
  }
}

class RefIdIndex extends ChunkedSet<object, IdChunk> {
  /** Changed when chunks are added or removed. */
  readonly chunksAtom = createAtom("refIdChunks")
  readonly byId = new NodesById<object>()
  /** Copies the chunks' id changes into `byId`. Changes when `byId` does. */
  readonly synced: IComputedValue<number>
  /** Set when `byId` changed outside of a sync, so the version must change. */
  private changedOutsideSync = false
  keeper: Reaction | undefined
  private readonly getId: GetId

  constructor(getId: GetId) {
    super()
    this.getId = getId
    let version = 0
    this.synced = computed(
      () => {
        this.chunksAtom.reportObserved()
        let changed = this.changedOutsideSync
        this.changedOutsideSync = false
        for (const chunk of this.chunks) {
          if (this.syncChunk(chunk)) {
            changed = true
          }
        }
        if (changed) {
          version++
        }
        return version
      },
      { name: "refIdIndex" }
    )
  }

  protected createChunk(nodes: object[]): IdChunk {
    return new IdChunk(nodes, this.getId)
  }

  protected onChunkChanged(chunk: IdChunk): void {
    chunk.atom.reportChanged()
  }

  protected onChunksChanged(): void {
    this.chunksAtom.reportChanged()
  }

  protected onChunkDropped(chunk: IdChunk): void {
    // its nodes (if any) moved to a chunk that will add their ids again
    const synced = chunk.syncedIds
    if (synced && synced.size > 0) {
      for (const [id, value] of synced) {
        forEachNode(value, (node) => this.byId.delete(id, node))
      }
      this.changedOutsideSync = true
    }
  }

  private syncChunk(chunk: IdChunk): boolean {
    const ids = chunk.ids.get()
    const previous = chunk.syncedIds
    if (ids === previous) {
      return false
    }
    chunk.syncedIds = ids

    let changed = false
    if (previous) {
      for (const [id, value] of previous) {
        if (!sameNodes(ids.get(id), value)) {
          forEachNode(value, (node) => this.byId.delete(id, node))
          changed = true
        }
      }
    }
    for (const [id, value] of ids) {
      if (!sameNodes(previous?.get(id), value)) {
        forEachNode(value, (node) => this.byId.add(id, node))
        changed = true
      }
    }
    return changed
  }
}

function forEachNode(value: object | object[], fn: (node: object) => void) {
  if (Array.isArray(value)) {
    value.forEach(fn)
  } else {
    fn(value)
  }
}

function sameNodes(a: object | object[] | undefined, b: object | object[]) {
  if (a === b) {
    return true
  }
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false
  }
  return a.every((node, i) => node === b[i])
}

function createRefIdIndexExtension(getId: GetId) {
  return registerDeepObjectChildrenExtension<RefIdIndex>({
    initData() {
      return new RefIdIndex(getId)
    },

    addNode(node, index) {
      index.add(node)
    },

    removeNode(node, index) {
      index.delete(node)
      return true
    },
  })
}

const refIdIndexes = new WeakMap<GetId, DeepObjectChildrenExtensionAccessor<RefIdIndex>>()

// Outside reactions and actions MobX does not cache computeds, so every
// untracked resolution would re-read every id. Keep the index observed until
// any of its ids change, then release it, so ids read from outside the tree
// cannot keep it alive.
function keepAliveUntilChanged(index: RefIdIndex) {
  if (index.keeper) {
    return
  }
  const keeper = new Reaction("refIdIndex keeper", () => {
    keeper.dispose()
    if (index.keeper === keeper) {
      index.keeper = undefined
    }
  })
  index.keeper = keeper
  keeper.track(() => {
    try {
      index.synced.get()
    } catch {
      // the caller's own read rethrows the cached error
    }
  })
}

/**
 * Resolves a node below the root (excluding it) whose `getId` is the given
 * id, reactively, in O(tree size / 128) plus the cost of re-reading the ids of
 * any chunk of 128 nodes that changed, plus O(nodes × depth) when several
 * nodes have that id.
 *
 * @internal
 */
export function resolveRefIdByIndex(root: object, id: string, getId: GetId): object | undefined {
  const accessor = getOrCreate(refIdIndexes, getId, () => createRefIdIndexExtension(getId))
  const index = accessor.get(root, false)

  keepAliveUntilChanged(index)
  index.synced.get()

  return index.byId.resolve(root, id)
}
