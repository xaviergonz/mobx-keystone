import type { AnyModel } from "../model/BaseModel"
import { getModelIdPropertyName } from "../model/getModelMetadata"
import { modelTypeKey } from "../model/metadata"
import { isModelSnapshot } from "../model/utils"
import { ModelClass } from "../modelShared/BaseModelShared"
import { getModelInfoForName } from "../modelShared/modelInfo"
import { dataObjectParent } from "../parent/core"
import { byModelTypeAndIdKey, getDeepObjectChildren } from "../parent/coreObjectChildren"

export class ModelPool {
  private pool: ReadonlyMap<string, AnyModel>

  constructor(root: object) {
    // make sure we don't use the sub-data $ object
    root = dataObjectParent.get(root) ?? root

    this.pool = getDeepObjectChildren(root).deepByModelTypeAndId
  }

  findModelByTypeAndId(modelType: string, modelId: string): AnyModel | undefined {
    return this.pool.get(byModelTypeAndIdKey(modelType, modelId))
  }

  findModelForSnapshot(sn: any): AnyModel | undefined {
    if (!isModelSnapshot(sn)) {
      return undefined
    }

    const modelType = sn[modelTypeKey]
    const modelInfo = getModelInfoForName(modelType)!
    const modelIdPropertyName = getModelIdPropertyName(modelInfo.class as ModelClass<AnyModel>)

    return this.findModelByTypeAndId(sn[modelTypeKey], sn[modelIdPropertyName])
  }
}
