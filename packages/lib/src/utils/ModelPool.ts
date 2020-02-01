import { isModel, isModelSnapshot } from "../model/utils"
import { dataObjectParent } from "../parent/core"
import { getDeepObjectChildren } from "../parent/coreObjectChildren"

export class ModelPool {
  private pool = new Map<string, object>()

  constructor(root: any) {
    this.addToPool(root)
  }

  private addOneToPool(value: any) {
    if (isModel(value)) {
      this.pool.set(getPoolKey(value.$modelType, value.$modelId), value)
    }
  }

  private addToPool(value: any) {
    // make sure we don't use the sub-data $ object
    value = dataObjectParent.get(value) || value

    // return all submodels to the pool
    this.addOneToPool(value)
    const iter = getDeepObjectChildren(value).values()
    let current = iter.next()
    while (!current.done) {
      this.addOneToPool(current.value)
      current = iter.next()
    }
  }

  findModelByTypeAndId(modelType: string, modelId: string): object | undefined {
    return this.pool.get(getPoolKey(modelType, modelId))
  }

  findModelForSnapshot(sn: any): object | undefined {
    if (!isModelSnapshot(sn)) {
      return undefined
    }

    return this.findModelByTypeAndId(sn.$modelType, sn.$modelId)
  }
}

function getPoolKey(modelType: string, modelId: string) {
  return modelType + " " + modelId
}
