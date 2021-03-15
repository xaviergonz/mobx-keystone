// this file only purpose is to break cyclic dependencies

import type { BaseDataModel } from "./BaseDataModel"

/**
 * @ignore
 * @internal
 */
export let _BaseDataModel: typeof BaseDataModel

/**
 * @ignore
 * @internal
 */
export function setBaseDataModel(baseModelClass: typeof BaseDataModel) {
  _BaseDataModel = baseModelClass
}
