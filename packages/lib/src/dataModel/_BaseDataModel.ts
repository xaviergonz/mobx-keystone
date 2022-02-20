// this file only purpose is to break cyclic dependencies

import type { BaseDataModel } from "./BaseDataModel"

/**
 * @internal
 */
export let _BaseDataModel: typeof BaseDataModel

/**
 * @internal
 */
export function setBaseDataModel(baseModelClass: typeof BaseDataModel) {
  _BaseDataModel = baseModelClass
}
