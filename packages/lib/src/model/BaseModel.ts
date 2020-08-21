import { observable } from "mobx"
import { O } from "ts-toolbelt"
import { getGlobalConfig } from "../globalConfig"
import { PropTransform } from "../propTransform"
import { memoTransformCache } from "../propTransform/propTransform"
import { getSnapshot } from "../snapshot/getSnapshot"
import { SnapshotInOfModel, SnapshotInOfObject, SnapshotOutOfModel } from "../snapshot/SnapshotOf"
import { typesModel } from "../typeChecking/model"
import { typeCheck } from "../typeChecking/typeCheck"
import { TypeCheckError } from "../typeChecking/TypeCheckError"
import { assertIsObject } from "../utils"
import { modelIdKey, modelTypeKey } from "./metadata"
import { modelInfoByClass } from "./modelInfo"
import { internalNewModel } from "./newModel"
import { assertIsModelClass } from "./utils"

/**
 * @ignore
 */
export declare const propsDataTypeSymbol: unique symbol

/**
 * @ignore
 */
export declare const propsCreationDataTypeSymbol: unique symbol

/**
 * @ignore
 */
export declare const instanceDataTypeSymbol: unique symbol

/**
 * @ignore
 */
export declare const instanceCreationDataTypeSymbol: unique symbol

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
  PropsData extends { [k: string]: any },
  PropsCreationData extends { [k: string]: any },
  InstanceData extends { [k: string]: any } = PropsData,
  InstanceCreationData extends { [k: string]: any } = PropsCreationData
> {
  // just to make typing work properly
  [propsDataTypeSymbol]: PropsData;
  [propsCreationDataTypeSymbol]: PropsCreationData;
  [instanceDataTypeSymbol]: InstanceData;
  [instanceCreationDataTypeSymbol]: InstanceCreationData;

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
   * This also allows access to the backed values of transformed properties.
   */
  readonly $!: PropsData

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
  }): SnapshotInOfObject<PropsCreationData> & { [modelTypeKey]?: string; [modelIdKey]?: string }

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
  constructor(data: InstanceCreationData & { [modelIdKey]?: string }) {
    let initialData: any = data
    const snapshotInitialData: any = arguments[1]
    const clazz: ModelClass<AnyModel> = arguments[2]
    const propsWithTransforms: [string, PropTransform<any, any>][] = arguments[4]

    Object.setPrototypeOf(this, clazz.prototype)

    if (!snapshotInitialData) {
      // plain new
      assertIsObject(initialData, "initialData")

      // apply transforms to initial data if needed
      const propsWithTransformsLen = propsWithTransforms.length
      if (propsWithTransformsLen > 0) {
        initialData = Object.assign(initialData)
        for (let i = 0; i < propsWithTransformsLen; i++) {
          const propWithTransform = propsWithTransforms[i]
          const propName = propWithTransform[0]
          const propTransform = propWithTransform[1]

          const memoTransform = memoTransformCache.getOrCreateMemoTransform(
            this,
            propName,
            propTransform
          )
          initialData[propName] = memoTransform.dataToProp(initialData[propName])
        }
      }

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
export interface AnyModel extends BaseModel<any, any> {}

/**
 * Extracts the instance type of a model class.
 */
export interface ModelClass<M extends AnyModel> {
  new (initialData: any): M
}

/**
 * A model class declaration, made of a base model and the model interface.
 */
export type ModelClassDeclaration<BaseModelClass, ModelInterface> = BaseModelClass & {
  new (...args: any[]): ModelInterface
}

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
 * Tricks Typescript into accepting a particular kind of generic class as a parameter for `ExtendedModel`.
 * Does nothing in runtime.
 *
 * @typeparam T Generic model class type.
 * @param type Generic model class.
 * @returns
 */
export function modelClass<T extends AnyModel>(type: { prototype: T }): ModelClass<T> {
  return type as any
}

/**
 * The props data type of a model.
 */
export type ModelPropsData<M extends AnyModel> = M["$"]

/**
 * The props creation data type of a model.
 */
export type ModelPropsCreationData<M extends AnyModel> = M[typeof propsCreationDataTypeSymbol]

/**
 * The instance data type of a model.
 */
export type ModelInstanceData<M extends AnyModel> = M[typeof instanceDataTypeSymbol]

/**
 * The transformed creation data type of a model.
 */
export type ModelInstanceCreationData<M extends AnyModel> = M[typeof instanceCreationDataTypeSymbol]

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
