import { action, observable } from "mobx"
import nanoid from "nanoid/non-secure"
import { Omit, Writable } from "ts-essentials"
import { HookAction } from "../action/hookActions"
import { wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { SnapshotInOfModel } from "../snapshot"
import { getInternalSnapshot, linkInternalSnapshot } from "../snapshot/internal"
import { tweakModel, tweakPlainObject } from "../tweaker/tweak"
import { assertIsObject, failure, makePropReadonly } from "../utils"
import { ModelMetadata, modelMetadataKey } from "./metadata"
import { modelInfoByClass } from "./modelInfo"
import { assertIsModelClass } from "./utils"

declare const typeSymbol: unique symbol

const modelConstructorSymbol = Symbol("modelConstructor")

/**
 * Base abstract class for models.
 *
 * Never use new directly over models, use `newModel` function instead.
 * Never override the constructor, use `onInit` or `onAttachedToRootStore` instead.
 * If you want to make certain data properties as optional then declare their default values in
 * `defaultData`.
 *
 * @typeparam Data Data type.
 */
export abstract class Model<Data extends { [k: string]: any }> {
  // just to make typing work properly
  [typeSymbol]: Data;

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
   * Default data for optional data when not provided.
   *
   * @abstract
   */
  readonly defaultData?: Partial<Readonly<Data>>

  /**
   * Data part of the model, which is observable and will be serialized in snapshots.
   * Use this to read/modify model data.
   */
  readonly data!: Data

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
   * Creates an instance of Model.
   * Never use this directly, use the `newModel` function instead.
   *
   * @param initialData
   */
  constructor(privateSymbol: typeof modelConstructorSymbol) {
    if (privateSymbol !== modelConstructorSymbol) {
      throw failure("models must be constructed using 'newModel'")
    }

    // rest of construction is done in internalNewModel
  }
}

/**
 * Any kind of model instance.
 */
export type AnyModel = Model<any>

/**
 * Type of the model class.
 */
export type ModelClass<M extends AnyModel> = new (privateSymbol: typeof modelConstructorSymbol) => M

/**
 * The creation data of a model.
 */
export type ModelCreationData<M extends AnyModel> = Omit<M["data"], keyof M["defaultData"]> &
  Partial<M["data"]>

/**
 * The data type of a model.
 */
export type ModelData<M extends AnyModel> = M["data"]

/**
 * Creates a new model of a given class.
 * Use this instead of the new operator.
 *
 * @typeparam M Model class.
 * @param modelClass Model class.
 * @param initialData Initial data.
 * @returns The model instance.
 */
export function newModel<M extends AnyModel>(
  modelClass: ModelClass<M>,
  initialData: ModelCreationData<M>
): M {
  assertIsObject(initialData, "initialData")

  return internalNewModel(
    modelClass,
    observable.object(initialData, undefined, { deep: false }),
    undefined
  )
}

/**
 * @ignore
 */
export const internalNewModel = action(
  "newModel",
  <M extends AnyModel>(
    modelClass: ModelClass<M>,
    initialData: ModelCreationData<M> | undefined,
    snapshotInitialData:
      | {
          unprocessedSnapshot: any
          id: string
          snapshotToInitialData(processedSnapshot: any): any
        }
      | undefined
  ): M => {
    assertIsModelClass(modelClass, "modelClass")

    const modelObj = new modelClass(modelConstructorSymbol) as Writable<M>

    // make defaultData non enumerable and readonly
    makePropReadonly(modelObj, "defaultData", false)

    const modelInfo = modelInfoByClass.get(modelClass)!
    let id
    if (snapshotInitialData) {
      id = snapshotInitialData.id
      let sn = snapshotInitialData.unprocessedSnapshot
      if (modelObj.fromSnapshot) {
        sn = modelObj.fromSnapshot(sn)
      }
      initialData = snapshotInitialData.snapshotToInitialData(sn)
    } else {
      id = nanoid()
    }

    modelObj[modelMetadataKey] = {
      type: modelInfo.name,
      id,
    }

    // fill in defaults in initial data
    const { defaultData } = modelObj
    if (defaultData) {
      const defaultDataKeys = Object.keys(defaultData as any)
      const defaultDataKeysLen = defaultDataKeys.length
      for (let i = 0; i < defaultDataKeysLen; i++) {
        const k = defaultDataKeys[i]
        if ((initialData as any)[k] === undefined) {
          ;(initialData as any)[k] = defaultData[k]
        }
      }
    }

    tweakModel(modelObj, undefined)

    // create observable data object with initial data

    let obsData = tweakPlainObject(
      initialData,
      { parent: modelObj, path: "data" },
      modelObj[modelMetadataKey],
      false
    )
    const newSn = getInternalSnapshot(obsData as any)!

    // make the model use the inner data field snapshot
    linkInternalSnapshot(modelObj, newSn)

    // link it, and make it readonly
    modelObj.data = obsData
    makePropReadonly(modelObj, "data", true)

    // run any extra initializers for the class as needed
    const initializers = modelClassInitializers.get(modelClass)
    if (initializers) {
      initializers.forEach(init => init(modelObj))
    }

    // the object is ready
    if (modelObj.onInit) {
      wrapModelMethodInActionIfNeeded(modelObj, "onInit", HookAction.OnInit)

      modelObj.onInit()
    }

    return modelObj
  }
)

type ModelClassInitializer = (modelInstance: AnyModel) => void

const modelClassInitializers = new WeakMap<ModelClass<AnyModel>, ModelClassInitializer[]>()

/**
 * @ignore
 */
export function addModelClassInitializer(
  modelClass: ModelClass<AnyModel>,
  init: ModelClassInitializer
) {
  let initializers = modelClassInitializers.get(modelClass)
  if (!initializers) {
    initializers = []
    modelClassInitializers.set(modelClass, initializers)
  }
  initializers.push(init)
}

/**
 * Add missing model metadata to a model creation snapshot to generate a proper model snapshot.
 *
 * @typeparam M Model type.
 * @param modelClass Model class.
 * @param snapshot Model creation snapshot without metadata.
 * @param [id] Optional model id, if not provided a new one will be generated.
 * @returns The model snapshot (including metadata).
 */
export function modelSnapshotWithMetadata<M extends AnyModel>(
  modelClass: ModelClass<M>,
  snapshot: Omit<SnapshotInOfModel<M>, typeof modelMetadataKey>,
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
