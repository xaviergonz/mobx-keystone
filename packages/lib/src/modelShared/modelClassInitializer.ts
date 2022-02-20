import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "./BaseModelShared"

/**
 * @internal
 */
export const modelInitializersSymbol = Symbol("modelInitializers")

type ModelClassInitializer = (modelInstance: AnyModel | AnyDataModel) => void

/**
 * @internal
 */
export function addModelClassInitializer(
  modelClass: ModelClass<AnyModel | AnyDataModel>,
  init: ModelClassInitializer
) {
  let initializers = (modelClass as any)[modelInitializersSymbol]
  if (!initializers) {
    initializers = []
    ;(modelClass as any)[modelInitializersSymbol] = initializers
  }
  initializers.push(init)
}

/**
 * @internal
 */
export function getModelClassInitializers(
  modelClass: ModelClass<AnyModel | AnyDataModel>
): ModelClassInitializer[] | undefined {
  return (modelClass as any)[modelInitializersSymbol]
}
