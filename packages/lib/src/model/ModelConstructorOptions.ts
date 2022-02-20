import type { ModelClass } from "../modelShared/BaseModelShared"
import type { AnyModel } from "./BaseModel"

/**
 * @internal
 */
export interface ModelConstructorOptions {
  snapshotInitialData?: {
    unprocessedSnapshot: any
    snapshotToInitialData(processedSnapshot: any): any
  }
  modelClass?: ModelClass<AnyModel>
  generateNewIds?: boolean
}
