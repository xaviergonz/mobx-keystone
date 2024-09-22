import type {
  AbstractModelClass,
  ModelClass,
  ModelCreationData,
} from "../modelShared/BaseModelShared"
import type {
  ModelProps,
  ModelPropsToSetter,
  ModelPropsToSnapshotCreationData,
  ModelPropsToSnapshotData,
  ModelPropsToTransformedCreationData,
  ModelPropsToTransformedData,
} from "../modelShared/prop"
import { sharedInternalModel } from "../modelShared/sharedInternalModel"
import type { AnyModel, BaseModel, BaseModelKeys, ModelIdPropertyName } from "./BaseModel"
import { assertIsModelClass, isModelClass } from "./utils"

export type _ComposedCreationData<
  SuperModel,
  TProps extends ModelProps,
> = SuperModel extends AnyModel
  ? ModelPropsToTransformedCreationData<TProps> & ModelCreationData<SuperModel>
  : ModelPropsToTransformedCreationData<TProps>

/**
 * The default type used by fromSnapshot before processors are applied.
 */
export type FromSnapshotDefaultType<TProps extends ModelProps> =
  ModelPropsToSnapshotCreationData<TProps>

/**
 * The default type used by getSnapshot before processors are applied.
 */
export type ToSnapshotDefaultType<TProps extends ModelProps> = ModelPropsToSnapshotData<TProps>

export type _ModelId<SuperModel, TProps extends ModelProps> = SuperModel extends AnyModel
  ? ModelIdPropertyName<SuperModel>
  : ExtractModelIdProp<TProps> & string

export interface _Model<
  SuperModel,
  TProps extends ModelProps,
  FromSnapshotOverride extends Record<string, any>,
  ToSnapshotOverride extends Record<string, any>,
> {
  new (
    data: _ComposedCreationData<SuperModel, TProps>
  ): SuperModel &
    BaseModel<TProps, FromSnapshotOverride, ToSnapshotOverride, _ModelId<SuperModel, TProps>> &
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
 * @typeparam TModelClass Model class type.
 * @param genFn Function that returns the base model and model properties.
 * @param modelOptions Model options.
 * @returns
 */
export function ExtendedModel<
  TProps extends ModelProps,
  TModelClass extends AbstractModelClass<AnyModel>,
  A extends [],
  FS extends Record<string, any> = never,
  TS extends Record<string, any> = never,
>(
  genFn: (...args: A) => {
    baseModel: TModelClass
    props: TProps
  },
  modelOptions?: ModelOptions<TProps, FS, TS>
): _Model<InstanceType<TModelClass>, TProps, FS, TS>

/**
 * Base abstract class for models that extends another model.
 *
 * @typeparam TProps New model properties type.
 * @typeparam TModelClass Model class type.
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @param modelOptions Model options.
 * @returns
 */
export function ExtendedModel<
  TProps extends ModelProps,
  TModelClass extends AbstractModelClass<AnyModel>,
  FS extends Record<string, any> = never,
  TS extends Record<string, any> = never,
>(
  baseModel: TModelClass,
  modelProps: TProps,
  modelOptions?: ModelOptions<TProps, FS, TS>
): _Model<InstanceType<TModelClass>, TProps, FS, TS> & Omit<TModelClass, "prototype">

// base
export function ExtendedModel<
  TProps extends ModelProps,
  TModelClass extends AbstractModelClass<AnyModel>,
  FS extends Record<string, any> = never,
  TS extends Record<string, any> = never,
>(...args: any[]): _Model<InstanceType<TModelClass>, TProps, FS, TS> {
  let baseModel: AbstractModelClass<AnyModel>
  let modelProps: TProps
  let modelOptions: ModelOptions<TProps, any, any>
  if (isModelClass(args[0])) {
    baseModel = args[0]
    modelProps = args[1]
    modelOptions = args[2]
  } else {
    const gen = (
      args[0] as () => {
        baseModel: ModelClass<AnyModel>
        props: TProps
      }
    )()

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
  FS extends Record<string, any> = never,
  TS extends Record<string, any> = never,
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
  FS extends Record<string, any> = never,
  TS extends Record<string, any> = never,
>(modelProps: TProps, modelOptions?: ModelOptions<TProps, FS, TS>): _Model<unknown, TProps, FS, TS>

// base
export function Model<
  TProps extends ModelProps,
  FS extends Record<string, any> = never,
  TS extends Record<string, any> = never,
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
  FS extends Record<string, any> = never,
  TS extends Record<string, any> = never,
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
  fromSnapshotProcessor?: (sn: FS) => FromSnapshotDefaultType<TProps>

  /**
   * Optional transformation that will be run when converting the data part of the model into a snapshot.
   *
   * @param sn The output snapshot.
   * @param modelInstance The model instance.
   * @returns  a custom output snapshot.
   */
  toSnapshotProcessor?: (sn: ToSnapshotDefaultType<TProps>, modelInstance: any) => TS
}
