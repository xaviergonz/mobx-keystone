import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelClassInitializers } from "../modelShared/modelClassInitializer"

export function applyModelInitializers(
  modelClass: ModelClass<AnyModel | AnyDataModel>,
  modelObj: any
) {
  const initializers = getModelClassInitializers(modelClass)
  if (initializers) {
    const len = initializers.length
    for (let i = 0; i < len; i++) {
      const init = initializers[i]
      init(modelObj)
    }
  }
}
