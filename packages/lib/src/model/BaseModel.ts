import nanoid from "nanoid/non-secure"
import { O } from "ts-toolbelt"
import { SnapshotInOfModel, SnapshotOutOfModel } from "../snapshot"
import { typesModel } from "../typeChecking/model"
import { typeCheck } from "../typeChecking/typeCheck"
import { TypeCheckError } from "../typeChecking/TypeCheckError"
import { assertIsObject, failure } from "../utils"
import { ModelMetadata, modelMetadataKey } from "./metadata"
import { modelConstructorSymbol, modelInfoByClass } from "./modelInfo"
import { assertIsModelClass } from "./utils"

declare const typeSymbol: unique symbol

/**
 * Base abstract class for models. Use `Model` instead when extending.
 *
 * Never use new directly over models, use `newModel` function instead.
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam Data Data type.
 * @typeparam CreationData Creation data type.
 */
export abstract class BaseModel<
  Data extends { [k: string]: any },
  CreationData extends { [k: string]: any }
> {
  // just to make typing work properly
  [typeSymbol]: [Data, CreationData];

  readonly [modelMetadataKey]: ModelMetadata

  /**
   * Gets the unique model ID of this model instance.
   */
  get modelId() {
    return this[modelMetadataKey].id
  }

  /**
   * Gets the model type name.
   */
  get modelType() {
    return this[modelMetadataKey].type
  }

  /**
   * Called after the model has been created.
   */
  onInit?(): void

  /**
   * Data part of the model, which is observable and will be serialized in snapshots.
   * Use it if one of the data properties matches one of the model properties/functions.
   */
  readonly $!: Data

  /**
   * Optional hook that will run once this model instance is attached to the tree of a model marked as
   * root store via `registerRootStore`.
   * Basically this is the place where you know the full root store is complete and where things such as
   * middlewares, effects (reactions, etc), and other side effects should be registered, since it means
   * that the model is now part of the active application state.
   *
   * It can return a disposer that will be run once this model instance is detached from such root store tree.
   *
   * @param rootStore
   * @returns
   */
  onAttachedToRootStore?(rootStore: object): (() => void) | void

  /**
   * Optional transformation that will be run when converting from a snapshot to the data part of the model.
   * Useful for example to do versioning and keep the data part up to date with the latest version of the model.
   *
   * @param snapshot
   * @returns
   */
  fromSnapshot?(snapshot: any): any

  /**
   * Performs a type check over the model instance.
   * For this to work a data type has to be declared in the model decorator.
   *
   * @returns A `TypeCheckError` or `null` if there is no error.
   */
  typeCheck(): TypeCheckError | null {
    const type = typesModel<this>(this.constructor as any)
    return typeCheck(type, this as any)
  }

  /**
   * Creates an instance of Model.
   * Never use this directly, use the `newModel` function instead.
   *
   * @param privateSymbol
   */
  constructor(privateSymbol: typeof modelConstructorSymbol) {
    if (privateSymbol !== modelConstructorSymbol) {
      throw failure("models must be constructed using 'newModel'")
    }

    // rest of construction is done in internalNewModel
  }
}

// these props will never be hoisted to this
export const baseModelPropNames = new Set<keyof AnyModel>([
  modelMetadataKey,
  "modelId",
  "modelType",
  "onInit",
  "$",
  "onAttachedToRootStore",
  "fromSnapshot",
  "typeCheck",
])

/**
 * Any kind of model instance.
 */
export type AnyModel = BaseModel<any, any>

/**
 * Type of the model class.
 */
export type ModelClass<M extends AnyModel> = new (privateSymbol: typeof modelConstructorSymbol) => M

/**
 * The data type of a model.
 */
export type ModelData<M extends AnyModel> = M["$"]

/**
 * The creation data type of a model.
 */
export type ModelCreationData<M extends AnyModel> = M extends BaseModel<any, infer C> ? C : never

/**
 * Add missing model metadata to a model creation snapshot to generate a proper model snapshot.
 * Usually used alongside `fromSnapshot`.
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @param snapshot Model creation snapshot without metadata.
 * @param [id] Optional model id, if not provided a new one will be generated.
 * @returns The model snapshot (including metadata).
 */
export function modelSnapshotInWithMetadata<M extends AnyModel>(
  modelClass: ModelClass<M>,
  snapshot: O.Omit<SnapshotInOfModel<M>, typeof modelMetadataKey>,
  id?: string
): SnapshotInOfModel<M> {
  assertIsModelClass(modelClass, "modelClass")
  assertIsObject(snapshot, "initialData")

  const modelInfo = modelInfoByClass.get(modelClass)!

  return {
    ...snapshot,
    [modelMetadataKey]: {
      id: id || nanoid(),
      type: modelInfo.name,
    },
  } as any
}

/**
 * Add missing model metadata to a model output snapshot to generate a proper model snapshot.
 * Usually used alongside `applySnapshot`.
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @param snapshot Model output snapshot without metadata.
 * @param [id] Optional model id, if not provided a new one will be generated.
 * @returns The model snapshot (including metadata).
 */
export function modelSnapshotOutWithMetadata<M extends AnyModel>(
  modelClass: ModelClass<M>,
  snapshot: O.Omit<SnapshotOutOfModel<M>, typeof modelMetadataKey>,
  id?: string
): SnapshotOutOfModel<M> {
  assertIsModelClass(modelClass, "modelClass")
  assertIsObject(snapshot, "initialData")

  const modelInfo = modelInfoByClass.get(modelClass)!

  return {
    ...snapshot,
    [modelMetadataKey]: {
      id: id || nanoid(),
      type: modelInfo.name,
    },
  } as any
}
