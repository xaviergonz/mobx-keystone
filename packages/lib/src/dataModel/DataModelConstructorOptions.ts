import type { ModelClass } from "../modelShared/BaseModelShared"
import type { AnyDataModel } from "./BaseDataModel"

/**
 * @internal
 * @ignore
 */
export interface DataModelConstructorOptions {
  modelClass?: ModelClass<AnyDataModel>
}
