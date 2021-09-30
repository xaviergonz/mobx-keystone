import type { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { modelIdKey, modelTypeKey } from "../model/metadata"
import { isModel, isModelSnapshot } from "../model/utils"
import { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { dataObjectParent } from "../parent/core"
import {
  getDeepObjectChildren,
  registerDeepObjectChildrenExtension,
} from "../parent/coreObjectChildren"

function byModelTypeAndIdKey(modelType: string, modelId: string) {
  return modelType + " " + modelId
}

export class ModelPool {
  private pool: ReadonlyMap<string, AnyModel>

  constructor(root: object) {
    // make sure we don't use the sub-data $ object
    root = dataObjectParent.get(root) ?? root

    this.pool = getDeepChildrenModels(getDeepObjectChildren(root))
  }

  findModelByTypeAndId(modelType: string, modelId: string | undefined): AnyModel | undefined {
    return modelId ? this.pool.get(byModelTypeAndIdKey(modelType, modelId)) : undefined
  }

  findModelForSnapshot(sn: any): AnyModel | undefined {
    if (!isModelSnapshot(sn)) {
      return undefined
    }

    const modelType = sn[modelTypeKey]
    const modelInfo = getModelInfoForName(modelType)!
    const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)

    return modelIdPropertyName
      ? this.findModelByTypeAndId(sn[modelTypeKey], (sn as any)[modelIdPropertyName])
      : undefined
  }
}

const getDeepChildrenModels = registerDeepObjectChildrenExtension<Map<string, AnyModel>>({
  initData() {
    return new Map()
  },

  addNode(node, data) {
    if (isModel(node)) {
      const id = node[modelIdKey]
      if (id) {
        data.set(byModelTypeAndIdKey(node[modelTypeKey], id), node)
      }
    }
  },
})
