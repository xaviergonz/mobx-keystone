import { isModelSnapshot } from "../model/utils"
import { dataObjectParent } from "../parent/core"
import { byModelTypeAndIdKey, getDeepObjectChildren } from "../parent/coreObjectChildren"

export class ModelPool {
  private pool: ReadonlyMap<string, object>

  constructor(root: object) {
    // make sure we don't use the sub-data $ object
    root = dataObjectParent.get(root) || root

    this.pool = getDeepObjectChildren(root).deepByModelTypeAndId
  }

  findModelByTypeAndId(modelType: string, modelId: string): object | undefined {
    return this.pool.get(byModelTypeAndIdKey(modelType, modelId))
  }

  findModelForSnapshot(sn: any): object | undefined {
    if (!isModelSnapshot(sn)) {
      return undefined
    }

    return this.findModelByTypeAndId(sn.$modelType, sn.$modelId)
  }
}
