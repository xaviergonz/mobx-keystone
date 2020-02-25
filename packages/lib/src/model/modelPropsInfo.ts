import { AnyModel, ModelClass } from "./BaseModel"
import { ModelProps } from "./prop"

const modelPropertiesSymbol = Symbol("modelProperties")

/**
 * @ignore
 * @internal
 *
 * Gets the info related to a model class properties.
 *
 * @param modelClass
 */
export function getInternalModelClassPropsInfo(modelClass: ModelClass<AnyModel>): ModelProps {
  return (modelClass as any)[modelPropertiesSymbol]
}

/**
 * @ignore
 * @internal
 *
 * Sets the info related to a model class properties.
 *
 * @param modelClass
 */
export function setInternalModelClassPropsInfo(
  modelClass: ModelClass<AnyModel>,
  props: ModelProps
): void {
  ;(modelClass as any)[modelPropertiesSymbol] = props
}
