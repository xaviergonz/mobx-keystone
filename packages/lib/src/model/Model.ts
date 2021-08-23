import type { AbstractModelClass, ModelClass } from "../modelShared/BaseModelShared"
import { sharedInternalModel } from "../modelShared/Model"
import {
  idProp,
  ModelProps,
  ModelPropsToCreationData,
  ModelPropsToData,
  ModelPropsToSetter,
  ModelPropsToTransformedCreationData,
  ModelPropsToTransformedData,
} from "../modelShared/prop"
import type { AnyModel, BaseModel, BaseModelKeys, ModelIdPropertyName } from "./BaseModel"
import { assertIsModelClass, isModelClass } from "./utils"

export type _ComposedCreationData<
  SuperModel,
  TProps extends ModelProps
> = SuperModel extends BaseModel<any, any, any, infer TCD>
  ? ModelPropsToTransformedCreationData<TProps> & TCD
  : ModelPropsToTransformedCreationData<TProps>

export type _ModelId<SuperModel, TProps extends ModelProps> = SuperModel extends AnyModel
  ? ModelIdPropertyName<SuperModel>
  : ExtractModelIdProp<TProps> & string

export interface _Model<SuperModel, TProps extends ModelProps> {
  new (data: _ComposedCreationData<SuperModel, TProps>): SuperModel &
    BaseModel<
      ModelPropsToData<TProps>,
      ModelPropsToCreationData<TProps>,
      ModelPropsToTransformedData<TProps>,
      ModelPropsToTransformedCreationData<TProps>,
      _ModelId<SuperModel, TProps>
    > &
    Omit<ModelPropsToTransformedData<TProps>, BaseModelKeys> &
    ModelPropsToSetter<TProps>
}

/**
 * @ignore
 * Ensures that a $modelId property is present if no idProp is provided.
 */
export type AddModelIdPropIfNeeded<TProps extends ModelProps> =
  ExtractModelIdProp<TProps> extends never
    ? TProps & { $modelId: typeof idProp } // we use the actual name here to avoid having to re-export the original
    : TProps

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
): _Model<unknown, AddModelIdPropIfNeeded<TProps>>

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
): _Model<unknown, AddModelIdPropIfNeeded<TProps>>

// base
export function Model<TProps extends ModelProps>(
  fnModelPropsOrModelProps: (() => TProps) | TProps,
  modelOptions?: ModelOptions
): _Model<unknown, AddModelIdPropIfNeeded<TProps>> {
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
): _Model<TBaseModel, AddModelIdPropIfNeeded<TProps>> {
  return sharedInternalModel({
    modelProps,
    baseModel,
    type: "class",
    valueType: modelOptions?.valueType ?? false,
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
