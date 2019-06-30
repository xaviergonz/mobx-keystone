import produce from "immer"
import nanoid from "nanoid/non-secure"
import { Omit, Writable } from "ts-essentials"
import { HookAction } from "../action/hookActions"
import { wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { InternalPatchRecorder } from "../patch/emitPatch"
import {
  getInternalSnapshot,
  linkInternalSnapshot,
  setInternalSnapshot,
} from "../snapshot/internal"
import { tweak } from "../tweaker/tweak"
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

  // we clone the initial data since it will be modified and we don't want to change the original
  return internalNewModel(modelClass, { ...initialData }, undefined)
}

/**
 * @ignore
 */
export function internalNewModel<M extends AnyModel>(
  modelClass: ModelClass<M>,
  initialData: ModelCreationData<M> | undefined,
  snapshotInitialData:
    | {
        unprocessedSnapshot: any
        id: string
        snapshotToInitialData(processedSnapshot: any): any
      }
    | undefined
): M {
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
    for (const [k, v] of Object.entries(defaultData as any)) {
      if (!(k in initialData!)) {
        ;(initialData as any)[k] = v
      }
    }
  }

  tweak(modelObj, undefined)

  // create observable data object with initial data
  let obsData = tweak(initialData, { parent: modelObj, path: "data" })
  const newSn = getInternalSnapshot(obsData as any)!
  const patchRecorder = new InternalPatchRecorder()

  const standard = produce(
    newSn.standard,
    (draftStandard: any) => {
      draftStandard[modelMetadataKey] = modelObj[modelMetadataKey]
    },
    patchRecorder.record
  )

  // make the model use the inner data field snapshot
  linkInternalSnapshot(modelObj, newSn)
  setInternalSnapshot(obsData, standard, patchRecorder)

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
