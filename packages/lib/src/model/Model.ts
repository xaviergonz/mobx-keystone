import { AbstractModelClass, ModelClass } from "../modelShared/BaseModelShared"
import { sharedInternalModel } from "../modelShared/Model"
import {
  idProp,
  ModelProps,
  ModelPropsToInstanceCreationData,
  ModelPropsToInstanceData,
  ModelPropsToPropsCreationData,
  ModelPropsToPropsData,
  ModelPropsToSetterActions,
} from "../modelShared/prop"
import type { AnyModel, BaseModel } from "./BaseModel"
import { modelTypeKey } from "./metadata"
import { assertIsModelClass } from "./utils"

declare const propsDataSymbol: unique symbol
declare const instanceDataSymbol: unique symbol

declare const propsCreationDataSymbol: unique symbol
declare const instanceCreationDataSymbol: unique symbol

declare const composedInstanceCreationDataSymbol: unique symbol

export interface _Model<SuperModel, TProps extends ModelProps> {
  /**
   * Model type name assigned to this class, or undefined if none.
   */
  readonly [modelTypeKey]: string | undefined

  [propsDataSymbol]: ModelPropsToPropsData<TProps>
  [instanceDataSymbol]: ModelPropsToInstanceData<TProps>

  [propsCreationDataSymbol]: ModelPropsToPropsCreationData<TProps>
  [instanceCreationDataSymbol]: ModelPropsToInstanceCreationData<TProps>

  [composedInstanceCreationDataSymbol]: SuperModel extends BaseModel<any, any, any, infer ICD, any>
    ? this[typeof instanceCreationDataSymbol] & ICD
    : this[typeof instanceCreationDataSymbol]

  new (data: this[typeof composedInstanceCreationDataSymbol]): SuperModel &
    BaseModel<
      this[typeof propsDataSymbol],
      this[typeof propsCreationDataSymbol],
      this[typeof instanceDataSymbol],
      this[typeof instanceCreationDataSymbol],
      ExtractModelIdProp<TProps> & string
    > &
    Omit<this[typeof instanceDataSymbol], keyof AnyModel> &
    ModelPropsToSetterActions<TProps>
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
 * @returns
 */
export function ExtendedModel<TProps extends ModelProps, TModel extends AnyModel>(
  baseModel: AbstractModelClass<TModel>,
  modelProps: TProps
): _Model<TModel, AddModelIdPropIfNeeded<TProps>> {
  assertIsModelClass(baseModel, "baseModel")

  return internalModel(modelProps, baseModel as any)
}

/**
 * Base abstract class for models.
 *
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam TProps Model properties type.
 * @param modelProps Model properties.
 */
export function Model<TProps extends ModelProps>(
  modelProps: TProps
): _Model<unknown, AddModelIdPropIfNeeded<TProps>> {
  return internalModel(modelProps, undefined)
}

function internalModel<TProps extends ModelProps, TBaseModel extends AnyModel>(
  modelProps: TProps,
  baseModel: ModelClass<TBaseModel> | undefined
): _Model<TBaseModel, AddModelIdPropIfNeeded<TProps>> {
  return sharedInternalModel(modelProps, baseModel, "class")
}
