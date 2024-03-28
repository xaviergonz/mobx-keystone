import { observable } from "mobx"
import {
  fromSnapshotOverrideTypeSymbol,
  ModelClass,
  propsTypeSymbol,
  toSnapshotOverrideTypeSymbol,
} from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import type {
  ModelProps,
  ModelPropsToTransformedCreationData,
  ModelPropsToUntransformedData,
} from "../modelShared/prop"
import { getSnapshot } from "../snapshot/getSnapshot"
import type { SnapshotInOfModel, SnapshotOutOfModel } from "../snapshot/SnapshotOf"
import { typesModel } from "../types/objectBased/typesModel"
import { typeCheck } from "../types/typeCheck"
import type { TypeCheckError } from "../types/TypeCheckError"
import { assertIsObject, failure } from "../utils"
import { getModelIdPropertyName } from "./getModelMetadata"
import { modelIdKey, modelTypeKey } from "./metadata"
import type { ModelConstructorOptions } from "./ModelConstructorOptions"
import { internalFromSnapshotModel, internalNewModel } from "./newModel"
import { assertIsModelClass } from "./utils"

/**
 * @ignore
 */
export const modelIdPropertyNameSymbol = Symbol("modelIdPropertyName")

/**
 * @ignore
 */
export type ModelIdPropertyType<TProps extends ModelProps, ModelIdPropertyName extends string> = [
  ModelIdPropertyName,
] extends [never]
  ? never
  : ModelPropsToUntransformedData<Pick<TProps, ModelIdPropertyName>>[ModelIdPropertyName]

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
  TProps extends ModelProps,
  FromSnapshotOverride extends Record<string, any>,
  ToSnapshotOverride extends Record<string, any>,
  ModelIdPropertyName extends string = never,
> {
  // just to make typing work properly
  [propsTypeSymbol]!: TProps;
  [fromSnapshotOverrideTypeSymbol]!: FromSnapshotOverride;
  [toSnapshotOverrideTypeSymbol]!: ToSnapshotOverride;
  [modelIdPropertyNameSymbol]!: ModelIdPropertyName;

  /**
   * Model type name.
   */
  readonly [modelTypeKey]!: string

  /**
   * Model internal id. Can be modified inside a model action.
   * It will return `undefined` if there's no id prop set.
   */
  get [modelIdKey](): ModelIdPropertyType<TProps, ModelIdPropertyName> {
    const idProp = getModelIdPropertyName(this.constructor as any)
    return idProp ? this.$[idProp] : (undefined as any)
  }

  set [modelIdKey](newId: ModelIdPropertyType<TProps, ModelIdPropertyName>) {
    const idProp = getModelIdPropertyName(this.constructor as any)
    if (!idProp) {
      throw failure("$modelId cannot be set when there is no idProp set in the model")
    }
    ;(this.$ as any)[idProp] = newId
  }

  /**
   * Can be overridden to offer a reference id to be used in reference resolution.
   * By default it will use the `idProp` if available or return `undefined` otherwise.
   */
  getRefId(): string | undefined {
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
  readonly $!: ModelPropsToUntransformedData<TProps>

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
  constructor(data: ModelPropsToTransformedCreationData<TProps>) {
    const initialData = data as any
    const { snapshotInitialData, modelClass, generateNewIds }: ModelConstructorOptions =
      // eslint-disable-next-line prefer-rest-params
      arguments[1] as any

    Object.setPrototypeOf(this, modelClass!.prototype)

    const self = this as any

    // delete unnecessary props
    delete self[propsTypeSymbol]
    delete self[fromSnapshotOverrideTypeSymbol]
    delete self[toSnapshotOverrideTypeSymbol]
    delete self[modelIdPropertyNameSymbol]

    if (!snapshotInitialData) {
      // plain new
      assertIsObject(initialData, "initialData")

      internalNewModel(
        this,
        observable.object(initialData as any, undefined, { deep: false }),
        modelClass!
      )
    } else {
      // from snapshot
      internalFromSnapshotModel(this, snapshotInitialData!, modelClass!, !!generateNewIds)
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
  "typeCheck",
])

/**
 * Any kind of model instance.
 */
export interface AnyModel extends BaseModel<any, any, any, any> {}

/**
 * @deprecated Should not be needed anymore.
 *
 * Tricks TypeScript into accepting abstract classes as a parameter for `ExtendedModel`.
 * Does nothing in runtime.
 *
 * @typeparam T Abstract model class type.
 * @param type Abstract model class.
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/ban-types
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
 * @returns The model snapshot (including metadata).
 */
export function modelSnapshotInWithMetadata<M extends AnyModel>(
  modelClass: ModelClass<M>,
  snapshot: Omit<SnapshotInOfModel<M>, typeof modelTypeKey>
): SnapshotInOfModel<M> {
  assertIsModelClass(modelClass, "modelClass")
  assertIsObject(snapshot, "initialData")

  const modelInfo = modelInfoByClass.get(modelClass)!

  return {
    ...snapshot,
    [modelTypeKey]: modelInfo.name,
  } as any
}

/**
 * Add missing model metadata to a model output snapshot to generate a proper model snapshot.
 * Usually used alongside `applySnapshot`.
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @param snapshot Model output snapshot without metadata.
 * @returns The model snapshot (including metadata).
 */
export function modelSnapshotOutWithMetadata<M extends AnyModel>(
  modelClass: ModelClass<M>,
  snapshot: Omit<SnapshotOutOfModel<M>, typeof modelTypeKey>
): SnapshotOutOfModel<M> {
  assertIsModelClass(modelClass, "modelClass")
  assertIsObject(snapshot, "initialData")

  const modelInfo = modelInfoByClass.get(modelClass)!

  return {
    ...snapshot,
    [modelTypeKey]: modelInfo.name,
  } as any
}

/**
 * A model class declaration, made of a base model and the model interface.
 */
export type ModelClassDeclaration<BaseModelClass, ModelInterface> = BaseModelClass & {
  new (...args: any[]): ModelInterface
}
