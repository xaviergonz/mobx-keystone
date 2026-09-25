import type { AnyModel } from "../model/BaseModel"
import { modelIdKey, modelTypeKey } from "../model/metadata"
import { isModel } from "../model/utils"
import { dataToModelNode } from "../parent/core"
import {
  type DeepObjectChildrenExtensionAccessor,
  type PinnedDeepObjectChildrenExtensionData,
  registerDeepObjectChildrenExtension,
} from "../parent/coreObjectChildren"
import { getOrCreate } from "./mapUtils"

type ModelsById = Map<string, AnyModel>
type ModelsByTypeAndId = Map<string, ModelsById>

interface DeepChildrenModels {
  readonly byTypeAndId: ModelsByTypeAndId
  /** Id each model is indexed under, since ids can change later. */
  readonly indexedIds: Map<AnyModel, string>
  /** Whether some model was shadowed by another one with the same type and id. */
  hasDuplicates: boolean
}

/**
 * A view of the models under a node, as they were when the pool was created.
 * Must be released once no longer used.
 */
export class ModelPool {
  private readonly pool: ReadonlyMap<string, ReadonlyMap<string, AnyModel>>
  private readonly pinned: PinnedDeepObjectChildrenExtensionData<DeepChildrenModels>

  constructor(root: object) {
    // make sure we don't use the sub-data $ object
    root = dataToModelNode(root)

    this.pinned = getDeepChildrenModels().pin(root)
    this.pool = this.pinned.data.byTypeAndId
  }

  release(): void {
    this.pinned.release()
  }

  findModelByTypeAndId(modelType: string, modelId: string | undefined): AnyModel | undefined {
    return modelId !== undefined ? this.pool.get(modelType)?.get(modelId) : undefined
  }
}

let deepChildrenModels: DeepObjectChildrenExtensionAccessor<DeepChildrenModels> | undefined

// Registered on first use to keep ModelPool out of the coreObjectChildren
// module-initialization cycle.
function getDeepChildrenModels() {
  deepChildrenModels ??= registerDeepObjectChildrenExtension<DeepChildrenModels>({
    initData() {
      return {
        byTypeAndId: new Map(),
        indexedIds: new Map(),
        hasDuplicates: false,
      }
    },

    // last one wins when rebuilding
    addNode(node, data) {
      if (isModel(node)) {
        const id = node[modelIdKey]
        if (id !== undefined) {
          const modelsById = getOrCreate(data.byTypeAndId, node[modelTypeKey], () => new Map())
          const previous = modelsById.get(id)
          if (previous) {
            data.hasDuplicates = true
            data.indexedIds.delete(previous)
          }
          modelsById.set(id, node)
          data.indexedIds.set(node, id)
        }
      }
    },

    addNodeIncrementally(node, data) {
      if (isModel(node)) {
        const id = node[modelIdKey]
        if (id !== undefined) {
          const modelsById = getOrCreate(data.byTypeAndId, node[modelTypeKey], () => new Map())
          if (modelsById.has(id)) {
            // which duplicate wins depends on the deep children order
            return false
          }
          modelsById.set(id, node)
          data.indexedIds.set(node, id)
        }
      }
      return true
    },

    removeNode(node, data) {
      if (isModel(node)) {
        if (data.hasDuplicates) {
          // a shadowed duplicate might need to take its place
          return false
        }
        const id = data.indexedIds.get(node)
        if (id !== undefined) {
          data.indexedIds.delete(node)
          data.byTypeAndId.get(node[modelTypeKey])!.delete(id)
        }
      }
      return true
    },

    dependsOnModelIds: true,
  })
  return deepChildrenModels
}
