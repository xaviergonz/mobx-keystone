import type { AbstractModelClass, ModelClass } from "../modelShared/BaseModelShared"
import { sharedInternalModel } from "../modelShared/Model"
import {
  idProp,
  ModelProps,
  ModelPropsToCreationData,
  ModelPropsToData,
  ModelPropsToSetter,
} from "../modelShared/prop"
import type { AnyModel, BaseModel, BaseModelKeys } from "./BaseModel"
import { modelTypeKey } from "./metadata"
import { assertIsModelClass } from "./utils"

declare const dataSymbol: unique symbol

declare const creationDataSymbol: unique symbol

declare const composedCreationDataSymbol: unique symbol

export interface _Model<SuperModel, TProps extends ModelProps> {
  /**
   * Model type name assigned to this class, or undefined if none.
   */
  readonly [modelTypeKey]: string | undefined

  [dataSymbol]: ModelPropsToData<TProps>

  [creationDataSymbol]: ModelPropsToCreationData<TProps>

  [composedCreationDataSymbol]: SuperModel extends BaseModel<any, infer CD, any>
    ? this[typeof creationDataSymbol] & CD
    : this[typeof creationDataSymbol]

  new (data: this[typeof composedCreationDataSymbol]): SuperModel &
    BaseModel<
      this[typeof dataSymbol],
      this[typeof creationDataSymbol],
      ExtractModelIdProp<TProps> & string
    > &
    Omit<this[typeof dataSymbol], BaseModelKeys> &
    ModelPropsToSetter<TProps>
}

/**
 * @ignore
 * Ensures that a $modelId property is present if no idProp is provided.
 */
export type AddModelIdPropIfNeeded<
  TProps extends ModelProps
> = ExtractModelIdProp<TProps> extends never
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
 * @param baseModel Base model type.
 * @param modelProps Model properties.
 * @param modelOptions Model options.
 * @returns
 */
export function ExtendedModel<TProps extends ModelProps, TModel extends AnyModel>(
  baseModel: AbstractModelClass<TModel>,
  modelProps: TProps,
  modelOptions?: ModelOptions
): _Model<TModel, AddModelIdPropIfNeeded<TProps>> {
  assertIsModelClass(baseModel, "baseModel")

  return internalModel(modelProps, baseModel as any, modelOptions)
}

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
): _Model<unknown, AddModelIdPropIfNeeded<TProps>> {
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
