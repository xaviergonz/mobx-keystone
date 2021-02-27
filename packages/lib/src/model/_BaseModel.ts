// this file only purpose is to break cyclic dependencies

import type { BaseModel } from "./BaseModel"

/**
 * @ignore
 * @internal
 */
export let _BaseModel: typeof BaseModel

/**
 * @ignore
 * @internal
 */
export function setBaseModel(baseModelClass: typeof BaseModel) {
  _BaseModel = baseModelClass
}
