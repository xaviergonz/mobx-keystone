import { AnyModel } from "../model/BaseModel"
import { modelIdKey, modelTypeKey } from "../model/metadata"
import { isModelSnapshot } from "../model/utils"
import { dataObjectParent } from "../parent/core"
import { byModelTypeAndIdKey, getDeepObjectChildren } from "../parent/coreObjectChildren"

export class ModelPool {
  private pool: ReadonlyMap<string, AnyModel>

  constructor(root: object) {
    // make sure we don't use the sub-data $ object
    root = dataObjectParent.get(root) || root

    this.pool = getDeepObjectChildren(root).deepByModelTypeAndId
  }

  findModelByTypeAndId(modelType: string, modelId: string): AnyModel | undefined {
    return this.pool.get(byModelTypeAndIdKey(modelType, modelId))
  }

  findModelForSnapshot(sn: any): AnyModel | undefined {
    if (!isModelSnapshot(sn)) {
      return undefined
    }

    return this.findModelByTypeAndId(sn[modelTypeKey], sn[modelIdKey])
  }
}
