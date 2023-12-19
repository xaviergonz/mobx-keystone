import type { ModelClass } from "../modelShared/BaseModelShared"
import type { AnyModel } from "./BaseModel"

/**
 * @internal
 */
export interface ModelConstructorOptions {
  snapshotInitialData?: {
    unprocessedSnapshot: any
    unprocessedModelType: unknown
    snapshotToInitialData(processedSnapshot: any): any
  }
  modelClass?: ModelClass<AnyModel>
  generateNewIds?: boolean
}
