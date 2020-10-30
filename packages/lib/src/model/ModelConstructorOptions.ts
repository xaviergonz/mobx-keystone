import { PropTransform } from "../propTransform/propTransform"
import { AnyModel, ModelClass } from "./BaseModel"

/**
 * @internal
 * @ignore
 */

export interface ModelConstructorOptions {
  snapshotInitialData?: {
    unprocessedSnapshot: any
    snapshotToInitialData(processedSnapshot: any): any
  }
  modelClass?: ModelClass<AnyModel>
  generateNewIds?: boolean
  propsWithTransforms?: ReadonlyArray<readonly [string, PropTransform<any, any>]>
}
