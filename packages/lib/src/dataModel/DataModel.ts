import type {
  AbstractModelClass,
  ModelClass,
  ModelCreationData,
  ModelTransformedCreationData,
} from "../modelShared/BaseModelShared"
import { sharedInternalModel } from "../modelShared/Model"
import type {
  ModelProps,
  ModelPropsToCreationData,
  ModelPropsToSetter,
  ModelPropsToTransformedCreationData,
  ModelPropsToTransformedData,
} from "../modelShared/prop"
import type { AnyDataModel, BaseDataModel, BaseDataModelKeys } from "./BaseDataModel"
import { assertIsDataModelClass, isDataModelClass } from "./utils"

export type _ComposedData<SuperModel, TProps extends ModelProps> = SuperModel extends AnyDataModel
  ?
      | (ModelPropsToCreationData<TProps> & ModelCreationData<SuperModel>)
      | (ModelPropsToTransformedCreationData<TProps> & ModelTransformedCreationData<SuperModel>)
  : ModelPropsToCreationData<TProps> | ModelPropsToTransformedCreationData<TProps>

export interface _DataModel<SuperModel, TProps extends ModelProps> {
  new (data: _ComposedData<SuperModel, TProps>): SuperModel &
    BaseDataModel<TProps> &
    Omit<ModelPropsToTransformedData<TProps>, BaseDataModelKeys> &
    ModelPropsToSetter<TProps>
}

/**
 * Base abstract class for data models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TModel Model type.
 * @param genFn Function that returns the base model and model properties.
 * @returns
 */
export function ExtendedDataModel<
  TProps extends ModelProps,
  TModel extends AnyDataModel,
  A extends []
>(
  genFn: (...args: A) => {
    baseModel: AbstractModelClass<TModel>
    props: TProps
  }
): _DataModel<TModel, TProps>

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
): _DataModel<TModel, TProps>

// base
export function ExtendedDataModel<TProps extends ModelProps, TModel extends AnyDataModel>(
  ...args: any[]
): _DataModel<TModel, TProps> {
  let baseModel
  let modelProps
  if (isDataModelClass(args[0])) {
    baseModel = args[0]
    modelProps = args[1]
  } else {
    const gen = args[0]()

    baseModel = gen.baseModel
    modelProps = gen.props
  }

  assertIsDataModelClass(baseModel, "baseModel")

  return internalDataModel(modelProps, baseModel as any)
}

/**
 * Base abstract class for data models.
 *
 * Never override the constructor, use `onLazyInit` or `onLazyAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param fnModelProps Function that generates model properties.
 */
export function DataModel<TProps extends ModelProps, A extends []>(
  fnModelProps: (...args: A) => TProps
): _DataModel<unknown, TProps>

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
): _DataModel<unknown, TProps>

// base
export function DataModel<TProps extends ModelProps>(
  fnModelPropsOrModelProps: (() => TProps) | TProps
): _DataModel<unknown, TProps> {
  const modelProps =
    typeof fnModelPropsOrModelProps === "function"
      ? fnModelPropsOrModelProps()
      : fnModelPropsOrModelProps
  return internalDataModel(modelProps, undefined)
}

function internalDataModel<TProps extends ModelProps, TBaseModel extends AnyDataModel>(
  modelProps: TProps,
  baseModel: ModelClass<TBaseModel> | undefined
): _DataModel<TBaseModel, TProps> {
  return sharedInternalModel({
    modelProps,
    baseModel,
    type: "data",
    valueType: false,
    fromSnapshotProcessor: undefined,
    toSnapshotProcessor: undefined,
  })
}
