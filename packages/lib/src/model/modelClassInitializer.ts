import type { AnyModel, ModelClass } from "./BaseModel"

/**
 * @internal
 * @ignore
 */
export const modelInitializersSymbol = Symbol("modelInitializers")

type ModelClassInitializer = (modelInstance: AnyModel) => void

/**
 * @internal
 * @ignore
 */
export function addModelClassInitializer(
  modelClass: ModelClass<AnyModel>,
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
 * @ignore
 */
export function getModelClassInitializers(
  modelClass: ModelClass<AnyModel>
): ModelClassInitializer[] | undefined {
  return (modelClass as any)[modelInitializersSymbol]
}
