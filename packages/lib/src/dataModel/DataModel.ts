import { AbstractModelClass, ModelClass } from "../modelShared/BaseModelShared"
import { sharedInternalModel } from "../modelShared/Model"
import { ModelProps, ModelPropsToData, ModelPropsToSetter } from "../modelShared/prop"
import { AnyDataModel, BaseDataModel } from "./BaseDataModel"
import { assertIsDataModelClass } from "./utils"

declare const dataSymbol: unique symbol

declare const composedDataSymbol: unique symbol

export interface _DataModel<SuperModel, TProps extends ModelProps> {
  [dataSymbol]: ModelPropsToData<TProps>

  [composedDataSymbol]: SuperModel extends BaseDataModel<infer D>
    ? this[typeof dataSymbol] & D
    : this[typeof dataSymbol]

  new (data: this[typeof composedDataSymbol]): SuperModel &
    BaseDataModel<this[typeof dataSymbol]> &
    Omit<this[typeof dataSymbol], keyof AnyDataModel> &
    ModelPropsToSetter<TProps>
}

/**
 * Base abstract class for data models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TModel Model type.
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @returns
 */
export function ExtendedDataModel<TProps extends ModelProps, TModel extends AnyDataModel>(
  baseModel: AbstractModelClass<TModel>,
  modelProps: TProps
): _DataModel<TModel, TProps> {
  assertIsDataModelClass(baseModel, "baseModel")

  return internalDataModel(modelProps, baseModel as any)
}

/**
 * Base abstract class for data models.
 *
 * Never override the constructor, use `onLazyInit` or `onLazyAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param modelProps Model properties.
 */
export function DataModel<TProps extends ModelProps>(
  modelProps: TProps
): _DataModel<unknown, TProps> {
  return internalDataModel(modelProps, undefined)
}

function internalDataModel<TProps extends ModelProps, TBaseModel extends AnyDataModel>(
  modelProps: TProps,
  baseModel: ModelClass<TBaseModel> | undefined
): _DataModel<TBaseModel, TProps> {
  return sharedInternalModel(modelProps, baseModel, "data")
}
