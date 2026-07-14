import type { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { modelIdKey, modelTypeKey } from "../model/metadata"
import { getSnapshotModelType, isModel } from "../model/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { dataToModelNode } from "../parent/core"
import {
  getDeepObjectChildren,
  registerDeepObjectChildrenExtension,
} from "../parent/coreObjectChildren"

type ModelsById = Map<string, AnyModel>
type ModelsByTypeAndId = Map<string, ModelsById>

export class ModelPool {
  private pool: ReadonlyMap<string, ReadonlyMap<string, AnyModel>>

  constructor(root: object) {
    // make sure we don't use the sub-data $ object
    root = dataToModelNode(root)

    this.pool = getDeepChildrenModels(getDeepObjectChildren(root))
  }

  findModelByTypeAndId(modelType: string, modelId: string | undefined): AnyModel | undefined {
    return modelId ? this.pool.get(modelType)?.get(modelId) : undefined
  }

  findModelForSnapshot(sn: any): AnyModel | undefined {
    const modelType = getSnapshotModelType(sn)
    if (modelType === undefined) {
      return undefined
    }

    const modelInfo = getModelInfoForName(modelType)!
    const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)

    return modelIdPropertyName
      ? this.findModelByTypeAndId(modelType, (sn as any)[modelIdPropertyName])
      : undefined
  }
}

type GetDeepChildrenModels = (data: ReturnType<typeof getDeepObjectChildren>) => ModelsByTypeAndId

let getDeepChildrenModels: GetDeepChildrenModels = (data) => {
  // Register on first use to keep ModelPool out of the coreObjectChildren
  // module-initialization cycle. The extension getter backfills its index from
  // data.deep, so registering after a deep-children set already exists is safe.
  const getRegisteredDeepChildrenModels = registerDeepObjectChildrenExtension<ModelsByTypeAndId>({
    initData() {
      return new Map()
    },

    addNode(node, extensionData) {
      if (isModel(node)) {
        const id = node[modelIdKey]
        if (id) {
          const modelType = node[modelTypeKey]
          let modelsById = extensionData.get(modelType)
          if (!modelsById) {
            modelsById = new Map()
            extensionData.set(modelType, modelsById)
          }
          modelsById.set(id, node)
        }
      }
    },
  })

  getDeepChildrenModels = getRegisteredDeepChildrenModels
  return getRegisteredDeepChildrenModels(data)
}
