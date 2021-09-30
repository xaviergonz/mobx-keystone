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

export type _ModelId<SuperModel, TProps extends ModelProps> = SuperModel extends AnyModel
  ? ModelIdPropertyName<SuperModel>
  : ExtractModelIdProp<TProps> & string

export interface _Model<
  SuperModel,
  TProps extends ModelProps,
  FromSnapshot = SnapshotInOfObject<ModelPropsToCreationData<TProps>>,
  ToSnapshot = SnapshotOutOfObject<ModelPropsToData<TProps>>
> {
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
 * Optional transformation that will be run when converting from a snapshot to the data part of the model.
 * Useful for example to do versioning and keep the data part up to date with the latest version of the model.
 *
 * @param model The model to apply the transformation over.
 * @param fn The function that will convert the custom input snapshot. Returns an input snapshot that must
 * match the current model input snapshot.
 * @returns The model with the transform.
 */
export function fromSnapshotProcessor<
  FS,
  SuperModel,
  TProps extends ModelProps,
  FromSnapshot,
  ToSnapshot
>(
  model: _Model<SuperModel, TProps, FromSnapshot, ToSnapshot>,
  fn: (sn: FS) => FromSnapshot
): _Model<SuperModel, TProps, FS, ToSnapshot> {
  return (model as any).withFromSnapshotProcessor(fn)
}

/**
 * Optional transformation that will be run when converting the data part of the model into a snapshot.
 *
 * @param fn The function that will convert the output snapshot. Returns a custom output snapshot.
 * @returns  The model with the transform.
 */
export function toSnapshotProcessor<
  TS,
  SuperModel,
  TProps extends ModelProps,
  FromSnapshot,
  ToSnapshot
>(
  model: _Model<SuperModel, TProps, FromSnapshot, ToSnapshot>,
  fn: (sn: ToSnapshot, modelInstance: any) => TS
): _Model<SuperModel, TProps, FromSnapshot, TS> {
  return (model as any).withToSnapshotProcessor(fn)
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
export function ExtendedModel<TProps extends ModelProps, TModel extends AnyModel, A extends []>(
  genFn: (...args: A) => {
    baseModel: AbstractModelClass<TModel>
    props: TProps
  },
  modelOptions?: ModelOptions
): _Model<TModel, TProps>

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
export function ExtendedModel<TProps extends ModelProps, TModel extends AnyModel>(
  baseModel: AbstractModelClass<TModel>,
  modelProps: TProps,
  modelOptions?: ModelOptions
): _Model<TModel, TProps>

// base
export function ExtendedModel<TProps extends ModelProps, TModel extends AnyModel>(
  ...args: any[]
): _Model<TModel, TProps> {
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
export function Model<TProps extends ModelProps, A extends []>(
  fnModelProps: (...args: A) => TProps,
  modelOptions?: ModelOptions
): _Model<unknown, TProps>

/**
 * Base abstract class for models.
 *
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param modelProps Model properties.
 * @param modelOptions Model options.
 */
export function Model<TProps extends ModelProps>(
  modelProps: TProps,
  modelOptions?: ModelOptions
): _Model<unknown, TProps>

// base
export function Model<TProps extends ModelProps>(
  fnModelPropsOrModelProps: (() => TProps) | TProps,
  modelOptions?: ModelOptions
): _Model<unknown, TProps> {
  const modelProps =
    typeof fnModelPropsOrModelProps === "function"
      ? fnModelPropsOrModelProps()
      : fnModelPropsOrModelProps
  return internalModel(modelProps, undefined, modelOptions)
}

function internalModel<TProps extends ModelProps, TBaseModel extends AnyModel>(
  modelProps: TProps,
  baseModel: ModelClass<TBaseModel> | undefined,
  modelOptions?: ModelOptions
): _Model<TBaseModel, TProps> {
  return sharedInternalModel({
    modelProps,
    baseModel,
    type: "class",
    valueType: modelOptions?.valueType ?? false,
    fromSnapshotProcessor: undefined,
    toSnapshotProcessor: undefined,
  })
}

/**
 * Model options.
 */
export interface ModelOptions {
  /**
   * A value type will be cloned automatically when being attached to a new tree.
   * The default is `false`.
   */
  valueType?: boolean
}
