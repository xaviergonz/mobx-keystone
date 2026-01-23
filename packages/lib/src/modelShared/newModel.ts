import type { AnyDataModel } from "../dataModel/BaseDataModel"
import { enterInitPhase, exitInitPhase } from "../deepChange/onDeepChange"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { getModelClassInitializers } from "../modelShared/modelClassInitializer"

export function applyModelInitializers(
  modelClass: ModelClass<AnyModel | AnyDataModel>,
  modelObj: any
) {
  const initializers = getModelClassInitializers(modelClass)
  if (!initializers) {
    return
  }

  enterInitPhase()
  try {
    const len = initializers.length
    for (let i = 0; i < len; i++) {
      initializers[i](modelObj)
    }
  } finally {
    exitInitPhase()
  }
}
