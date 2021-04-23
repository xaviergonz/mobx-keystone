import { observable } from "mobx"
import type { O } from "ts-toolbelt"
import { getGlobalConfig } from "../globalConfig"
import { creationDataTypeSymbol, dataTypeSymbol, ModelClass } from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { getSnapshot } from "../snapshot/getSnapshot"
import type {
  SnapshotInOfModel,
  SnapshotInOfObject,
  SnapshotOutOfModel,
} from "../snapshot/SnapshotOf"
import { typesModel } from "../typeChecking/model"
import { typeCheck } from "../typeChecking/typeCheck"
import type { TypeCheckError } from "../typeChecking/TypeCheckError"
import { assertIsObject } from "../utils"
import { getModelIdPropertyName } from "./getModelMetadata"
import { modelIdKey, modelTypeKey } from "./metadata"
import type { ModelConstructorOptions } from "./ModelConstructorOptions"
import { internalNewModel } from "./newModel"
import { assertIsModelClass } from "./utils"
import { setBaseModel } from "./_BaseModel"

/**
 * @ignore
 */
export const modelIdPropertyNameSymbol = Symbol()

/**
 * Base abstract class for models. Use `Model` instead when extending.
 *
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam Data Data type.
 * @typeparam CreationData Creation data type.
 * @typeparam ModelIdPropertyName Model id property name.
 */
export abstract class BaseModel<
  Data extends { [k: string]: any },
  CreationData extends { [k: string]: any },
  ModelIdPropertyName extends string = never
> {
  // just to make typing work properly
  [dataTypeSymbol]: Data;
  [creationDataTypeSymbol]: CreationData;
  [modelIdPropertyNameSymbol]: ModelIdPropertyName;

  /**
   * Model type name.
   */
  readonly [modelTypeKey]: string

  /**
   * Model internal id. Can be modified inside a model action.
   */
  get [modelIdKey](): string {
    return this.$[getModelIdPropertyName(this.constructor as any)]
  }

  set [modelIdKey](newId: string) {
    ;(this.$ as any)[getModelIdPropertyName(this.constructor as any)] = newId
  }

  /**
   * Can be overriden to offer a reference id to be used in reference resolution.
   * By default it will use the model id property (usually `$modelId` unless overridden).
   */
  getRefId(): string {
    return this[modelIdKey]
  }

  /**
   * Called after the model has been created.
   */
  protected onInit?(): void

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
  protected onAttachedToRootStore?(rootStore: object): (() => void) | void

  /**
   * Optional transformation that will be run when converting from a snapshot to the data part of the model.
   * Useful for example to do versioning and keep the data part up to date with the latest version of the model.
   *
   * @param snapshot The custom input snapshot.
   * @returns An input snapshot that must match the current model input snapshot.
   */
  fromSnapshot?(snapshot: {
    [k: string]: any
  }): SnapshotInOfObject<CreationData> & {
    [modelTypeKey]?: string
  }

  /**
   * Performs a type check over the model instance.
   * For this to work a data type has to be declared as part of the model properties.
   *
   * @returns A `TypeCheckError` or `null` if there is no error.
   */
  typeCheck(): TypeCheckError | null {
    const type = typesModel<this>(this.constructor as any)
    return typeCheck(type, this as any)
  }

  /**
   * Creates an instance of a model.
   */
  constructor(data: CreationData) {
    let initialData = data as any
    const {
      snapshotInitialData,
      modelClass,
      generateNewIds,
    }: ModelConstructorOptions = arguments[1] as any

    Object.setPrototypeOf(this, modelClass!.prototype)

    const self = this as any

    // delete unnecessary props
    delete self[dataTypeSymbol]
    delete self[creationDataTypeSymbol]
    delete self[modelIdPropertyNameSymbol]

    if (!snapshotInitialData) {
      // plain new
      assertIsObject(initialData, "initialData")

      internalNewModel(this, observable.object(initialData as any, undefined, { deep: false }), {
        modelClass,
        generateNewIds: true,
      })
    } else {
      // from snapshot
      internalNewModel(this, undefined, { modelClass, snapshotInitialData, generateNewIds })
    }
  }

  toString(options?: { withData?: boolean }) {
    const finalOptions = {
      withData: true,
      ...options,
    }

    const firstPart = `${this.constructor.name}#${this[modelTypeKey]}`

    return finalOptions.withData
      ? `[${firstPart} ${JSON.stringify(getSnapshot(this))}]`
      : `[${firstPart}]`
  }
}

setBaseModel(BaseModel)

/**
 * @ignore
 */
export type BaseModelKeys = keyof AnyModel | "onInit" | "onAttachedToRootStore"

// these props will never be hoisted to this (except for model id)
/**
 * @internal
 */
export const baseModelPropNames = new Set<BaseModelKeys>([
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
export interface AnyModel extends BaseModel<any, any, any> {}

/**
 * @deprecated Should not be needed anymore.
 *
 * Tricks Typescript into accepting abstract classes as a parameter for `ExtendedModel`.
 * Does nothing in runtime.
 *
 * @typeparam T Abstract model class type.
 * @param type Abstract model class.
 * @returns
 */
export function abstractModelClass<T>(type: T): T & Object {
  return type as any
}

/**
 * The model id property name.
 */
export type ModelIdPropertyName<M extends AnyModel> = M[typeof modelIdPropertyNameSymbol]

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
  snapshot: O.Omit<SnapshotInOfModel<M>, ModelIdPropertyName<M> | typeof modelTypeKey>,
  internalId: string = getGlobalConfig().modelIdGenerator()
): SnapshotInOfModel<M> {
  assertIsModelClass(modelClass, "modelClass")
  assertIsObject(snapshot, "initialData")

  const modelInfo = modelInfoByClass.get(modelClass)!
  const modelIdPropertyName = getModelIdPropertyName(modelClass)

  return {
    ...snapshot,
    [modelTypeKey]: modelInfo.name,
    [modelIdPropertyName]: internalId,
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
  snapshot: O.Omit<SnapshotOutOfModel<M>, ModelIdPropertyName<M> | typeof modelTypeKey>,
  internalId: string = getGlobalConfig().modelIdGenerator()
): SnapshotOutOfModel<M> {
  assertIsModelClass(modelClass, "modelClass")
  assertIsObject(snapshot, "initialData")

  const modelInfo = modelInfoByClass.get(modelClass)!
  const modelIdPropertyName = getModelIdPropertyName(modelClass)

  return {
    ...snapshot,
    [modelTypeKey]: modelInfo.name,
    [modelIdPropertyName]: internalId,
  } as any
}

/**
 * A model class declaration, made of a base model and the model interface.
 */
export type ModelClassDeclaration<BaseModelClass, ModelInterface> = BaseModelClass & {
  new (...args: any[]): ModelInterface
}
