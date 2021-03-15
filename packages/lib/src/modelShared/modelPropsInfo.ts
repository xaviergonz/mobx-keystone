import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import type { ModelClass } from "./BaseModelShared"
import type { ModelProps } from "./prop"

const modelPropertiesSymbol = Symbol("modelProperties")

/**
 * @ignore
 * @internal
 *
 * Gets the info related to a model class properties.
 *
 * @param modelClass
 */
export function getInternalModelClassPropsInfo(
  modelClass: ModelClass<AnyModel | AnyDataModel>
): ModelProps {
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
  modelClass: ModelClass<AnyModel | AnyDataModel>,
  props: ModelProps
): void {
  ;(modelClass as any)[modelPropertiesSymbol] = props
}
