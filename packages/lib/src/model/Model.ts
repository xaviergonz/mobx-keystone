import type { AbstractModelClass, ModelClass } from "../modelShared/BaseModelShared"
import { sharedInternalModel } from "../modelShared/Model"
import {
  ModelProps,
  ModelPropsToCreationData,
  ModelPropsToData,
  ModelPropsToSetter,
  ModelPropsToTransformedCreationData,
  ModelPropsToTransformedData,
} from "../modelShared/prop"
import type { SnapshotInOfObject, SnapshotOutOfObject } from "../snapshot/SnapshotOf"
import type { AnyModel, BaseModel, BaseModelKeys, ModelIdPropertyName } from "./BaseModel"
import type { modelTypeKey } from "./metadata"
import { assertIsModelClass, isModelClass } from "./utils"

export type _ComposedCreationData<
  SuperModel,
  TProps extends ModelProps
> = SuperModel extends BaseModel<any, any, any, infer TCD, any, any, any>
  ? ModelPropsToTransformedCreationData<TProps> & TCD
  : ModelPropsToTransformedCreationData<TProps>

export type _FromSnapshot<TProps extends ModelProps> = SnapshotInOfObject<
  ModelPropsToCreationData<TProps>
>

export type _ToSnapshot<TProps extends ModelProps> = SnapshotOutOfObject<ModelPropsToData<TProps>>

export type _ModelId<SuperModel, TProps extends ModelProps> = SuperModel extends AnyModel
  ? ModelIdPropertyName<SuperModel>
  : ExtractModelIdProp<TProps> & string

export interface _Model<SuperModel, TProps extends ModelProps, FromSnapshot, ToSnapshot> {
  new (data: _ComposedCreationData<SuperModel, TProps>): SuperModel &
    BaseModel<
      ModelPropsToData<TProps>,
      ModelPropsToCreationData<TProps>,
      ModelPropsToTransformedData<TProps>,
      ModelPropsToTransformedCreationData<TProps>,
      FromSnapshot & {
        [modelTypeKey]: string
      },
      ToSnapshot & {
        [modelTypeKey]: string
      },
      _ModelId<SuperModel, TProps>
    > &
    Omit<ModelPropsToTransformedData<TProps>, BaseModelKeys> &
    ModelPropsToSetter<TProps>
}

/**
 * Extract the model id property from the model props.
 */
export type ExtractModelIdProp<TProps extends ModelProps> = {
  [K in keyof TProps]: TProps[K]["$isId"] extends true ? K : never
}[keyof TProps]

/**
 * Base abstract class for models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TModel Model type.
 * @param genFn Function that returns the base model and model properties.
 * @param modelOptions Model options.
 * @returns
 */
export function ExtendedModel<
  TProps extends ModelProps,
  TModel extends AnyModel,
  A extends [],
  FS = _FromSnapshot<TProps>,
  TS = _ToSnapshot<TProps>
>(
  genFn: (...args: A) => {
    baseModel: AbstractModelClass<TModel>
    props: TProps
  },
  modelOptions?: ModelOptions<TProps, FS, TS>
): _Model<TModel, TProps, FS, TS>

/**
 * Base abstract class for models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TModel Model type.
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @param modelOptions Model options.
 * @returns
 */
export function ExtendedModel<
  TProps extends ModelProps,
  TModel extends AnyModel,
  FS = _FromSnapshot<TProps>,
  TS = _ToSnapshot<TProps>
>(
  baseModel: AbstractModelClass<TModel>,
  modelProps: TProps,
  modelOptions?: ModelOptions<TProps, FS, TS>
): _Model<TModel, TProps, FS, TS>

// base
export function ExtendedModel<
  TProps extends ModelProps,
  TModel extends AnyModel,
  FS = _FromSnapshot<TProps>,
  TS = _ToSnapshot<TProps>
>(...args: any[]): _Model<TModel, TProps, FS, TS> {
  let baseModel
  let modelProps
  let modelOptions
  if (isModelClass(args[0])) {
    baseModel = args[0]
    modelProps = args[1]
    modelOptions = args[2]
  } else {
    const gen = args[0]()

    baseModel = gen.baseModel
    modelProps = gen.props
    modelOptions = args[1]
  }

  assertIsModelClass(baseModel, "baseModel")

  return internalModel(modelProps, baseModel as any, modelOptions)
}

/**
 * Base abstract class for models.
 *
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param fnModelProps Function that generates model properties.
 * @param modelOptions Model options.
 */
export function Model<
  TProps extends ModelProps,
  A extends [],
  FS = _FromSnapshot<TProps>,
  TS = _ToSnapshot<TProps>
>(
  fnModelProps: (...args: A) => TProps,
  modelOptions?: ModelOptions<TProps, FS, TS>
): _Model<unknown, TProps, FS, TS>

/**
 * Base abstract class for models.
 *
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param modelProps Model properties.
 * @param modelOptions Model options.
 */
export function Model<
  TProps extends ModelProps,
  FS = _FromSnapshot<TProps>,
  TS = _ToSnapshot<TProps>
>(modelProps: TProps, modelOptions?: ModelOptions<TProps, FS, TS>): _Model<unknown, TProps, FS, TS>

// base
export function Model<
  TProps extends ModelProps,
  FS = _FromSnapshot<TProps>,
  TS = _ToSnapshot<TProps>
>(
  fnModelPropsOrModelProps: (() => TProps) | TProps,
  modelOptions?: ModelOptions<TProps, FS, TS>
): _Model<unknown, TProps, FS, TS> {
  const modelProps =
    typeof fnModelPropsOrModelProps === "function"
      ? fnModelPropsOrModelProps()
      : fnModelPropsOrModelProps
  return internalModel(modelProps, undefined, modelOptions)
}

function internalModel<
  TProps extends ModelProps,
  TBaseModel extends AnyModel,
  FS = _FromSnapshot<TProps>,
  TS = _ToSnapshot<TProps>
>(
  modelProps: TProps,
  baseModel: ModelClass<TBaseModel> | undefined,
  modelOptions?: ModelOptions<TProps, FS, TS>
): _Model<TBaseModel, TProps, FS, TS> {
  return sharedInternalModel({
    modelProps,
    baseModel,
    type: "class",
    valueType: modelOptions?.valueType ?? false,
    fromSnapshotProcessor: modelOptions?.fromSnapshotProcessor,
    toSnapshotProcessor: modelOptions?.toSnapshotProcessor,
  })
}

/**
 * Model options.
 */
export interface ModelOptions<TProps extends ModelProps, FS, TS> {
  /**
   * A value type will be cloned automatically when being attached to a new tree.
   * The default is `false`.
   */
  valueType?: boolean

  /**
   * Optional transformation that will be run when converting from a snapshot to the data part of the model.
   * Useful for example to do versioning and keep the data part up to date with the latest version of the model.
   *
   * @param sn The custom input snapshot.
   * @returns An input snapshot that must match the expected model input snapshot.
   */
  fromSnapshotProcessor?(sn: FS): _FromSnapshot<TProps>

  /**
   * Optional transformation that will be run when converting the data part of the model into a snapshot.
   *
   * @param sn The output snapshot.
   * @param modelInstance The model instance.
   * @returns  a custom output snapshot.
   */
  toSnapshotProcessor?(sn: _ToSnapshot<TProps>, modelInstance: any): TS
}
