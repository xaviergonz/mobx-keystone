// this file only purpose is to break cyclic dependencies

import type { BaseModel } from "./BaseModel"

/**
 * @internal
 */
export let _BaseModel: typeof BaseModel

/**
 * @internal
 */
export function setBaseModel(baseModelClass: typeof BaseModel) {
  _BaseModel = baseModelClass
}
