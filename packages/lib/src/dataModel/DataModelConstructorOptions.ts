import type { ModelClass } from "../modelShared/BaseModelShared"
import type { AnyDataModel } from "./BaseDataModel"

/**
 * @internal
 */
export interface DataModelConstructorOptions {
  modelClass?: ModelClass<AnyDataModel>
}
