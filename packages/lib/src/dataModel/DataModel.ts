import { AbstractModelClass, ModelClass } from "../modelShared/BaseModelShared"
import { sharedInternalModel } from "../modelShared/Model"
import {
  ModelProps,
  ModelPropsToInstanceData,
  ModelPropsToPropsData,
  ModelPropsToSetterActions,
} from "../modelShared/prop"
import { AnyDataModel, BaseDataModel } from "./BaseDataModel"
import { assertIsDataModelClass } from "./utils"

declare const propsDataSymbol: unique symbol
declare const instanceDataSymbol: unique symbol

declare const composedPropsDataSymbol: unique symbol

export interface _DataModel<SuperModel, TProps extends ModelProps> {
  [propsDataSymbol]: ModelPropsToPropsData<TProps>
  [instanceDataSymbol]: ModelPropsToInstanceData<TProps>

  [composedPropsDataSymbol]: SuperModel extends BaseDataModel<infer PD, any>
    ? this[typeof propsDataSymbol] & PD
    : this[typeof propsDataSymbol]

  new (data: this[typeof composedPropsDataSymbol]): SuperModel &
    BaseDataModel<this[typeof propsDataSymbol], this[typeof instanceDataSymbol]> &
    Omit<this[typeof instanceDataSymbol], keyof AnyDataModel> &
    ModelPropsToSetterActions<TProps>
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
