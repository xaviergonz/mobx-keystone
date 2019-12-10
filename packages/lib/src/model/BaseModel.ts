import { observable } from "mobx"
import { O } from "ts-toolbelt"
import { getGlobalConfig } from "../globalConfig"
import { SnapshotInOfModel, SnapshotInOfObject, SnapshotOutOfModel } from "../snapshot/SnapshotOf"
import { typesModel } from "../typeChecking/model"
import { typeCheck } from "../typeChecking/typeCheck"
import { TypeCheckError } from "../typeChecking/TypeCheckError"
import { assertIsObject } from "../utils"
import { modelIdKey, modelTypeKey } from "./metadata"
import { modelInfoByClass } from "./modelInfo"
import { internalNewModel } from "./newModel"
import { assertIsModelClass } from "./utils"

declare const dataTypeSymbol: unique symbol
declare const creationDataTypeSymbol: unique symbol

/**
 * @ignore
 * @internal
 */
export const modelInitializedSymbol = Symbol("modelInitialized")

/**
 * Base abstract class for models. Use `Model` instead when extending.
 *
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
  [dataTypeSymbol]: Data;
  [creationDataTypeSymbol]: CreationData;

  /**
   * Model type name.
   */
  readonly [modelTypeKey]: string;

  /**
   * Model internal id. Can be modified inside a model action.
   */
  [modelIdKey]: string

  /**
   * Can be overriden to offer a reference id to be used in reference resolution.
   * By default it will use `$modelId`.
   */
  getRefId(): string {
    return this[modelIdKey]
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
   * @param snapshot The custom input snapshot.
   * @returns An input snapshot that must match the current model input snapshot.
   */
  fromSnapshot?(snapshot: {
    [k: string]: any
  }): SnapshotInOfObject<CreationData> & { [modelTypeKey]?: string; [modelIdKey]?: string }

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
   */
  constructor(data: CreationData & { [modelIdKey]?: string }) {
    const initialData: any = data
    const snapshotInitialData: any = arguments[1]
    const clazz: ModelClass<AnyModel> = arguments[2]

    Object.setPrototypeOf(this, clazz.prototype)

    if (!snapshotInitialData) {
      // plain new
      assertIsObject(initialData, "initialData")

      internalNewModel(
        this,
        clazz,
        observable.object(initialData, undefined, { deep: false }),
        undefined,
        true
      )
    } else {
      // from snapshot
      const generateNewId: boolean = !!arguments[3]
      internalNewModel(this, clazz, undefined, snapshotInitialData, generateNewId)
    }
  }
}

// these props will never be hoisted to this (except for model id)
/**
 * @internal
 */
export const baseModelPropNames = new Set<keyof AnyModel>([
  modelTypeKey,
  modelIdKey,
  "onInit",
  "$",
  "getRefId",
  "onAttachedToRootStore",
  "fromSnapshot",
  "typeCheck",
])

/**
 * Any kind of model instance.
 */
export type AnyModel = BaseModel<any, any>

/**
 * Extracts the instance type of a model class.
 */
export type ModelClass<M extends AnyModel> = new (
  initialData: ModelCreationData<M> & { [modelIdKey]?: string }
) => M

export declare const abstractModelClassSymbol: unique symbol

/**
 * Extracts the instance type of a class marked with `abstractModelClass`.
 */
export type AbstractModelClass<T extends AnyModel> = { [abstractModelClassSymbol]: T }

/**
 * Tricks Typescript into accepting abstract classes as a parameter for `ExtendedModel`.
 * Does nothing in runtime.
 *
 * @typeparam T Abstract model class type.
 * @param type Abstract model class.
 * @returns
 */
export function abstractModelClass<T>(type: T): T & { [abstractModelClassSymbol]: T } {
  return type as any
}

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
 * @param [internalId] Model internal ID, or `undefined` to generate a new one.
 * @returns The model snapshot (including metadata).
 */
export function modelSnapshotInWithMetadata<M extends AnyModel>(
  modelClass: ModelClass<M>,
  snapshot: O.Omit<SnapshotInOfModel<M>, typeof modelIdKey | typeof modelTypeKey>,
  internalId: string = getGlobalConfig().modelIdGenerator()
): SnapshotInOfModel<M> {
  assertIsModelClass(modelClass, "modelClass")
  assertIsObject(snapshot, "initialData")

  const modelInfo = modelInfoByClass.get(modelClass)!

  return {
    ...snapshot,
    [modelTypeKey]: modelInfo.name,
    [modelIdKey]: internalId,
  } as any
}

/**
 * Add missing model metadata to a model output snapshot to generate a proper model snapshot.
 * Usually used alongside `applySnapshot`.
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @param snapshot Model output snapshot without metadata.
 * @param [internalId] Model internal ID, or `undefined` to generate a new one.
 * @returns The model snapshot (including metadata).
 */
export function modelSnapshotOutWithMetadata<M extends AnyModel>(
  modelClass: ModelClass<M>,
  snapshot: O.Omit<SnapshotOutOfModel<M>, typeof modelIdKey | typeof modelTypeKey>,
  internalId: string = getGlobalConfig().modelIdGenerator()
): SnapshotOutOfModel<M> {
  assertIsModelClass(modelClass, "modelClass")
  assertIsObject(snapshot, "initialData")

  const modelInfo = modelInfoByClass.get(modelClass)!

  return {
    ...snapshot,
    [modelTypeKey]: modelInfo.name,
    [modelIdKey]: internalId,
  } as any
}
