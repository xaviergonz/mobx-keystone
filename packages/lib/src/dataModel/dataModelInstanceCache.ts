import type { ModelClass } from "../modelShared/BaseModelShared"
import type { AnyDataModel } from "./BaseDataModel"

/** @internal */
export const dataModelInstanceCache = new WeakMap<
  ModelClass<AnyDataModel>,
  WeakMap<object, AnyDataModel>
>()
