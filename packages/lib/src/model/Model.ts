import produce from "immer"
import { v4 as uuidV4 } from "uuid"
import { runUnprotected } from "../action"
import { InternalPatchRecorder } from "../patch/emitPatch"
import {
  getInternalSnapshot,
  linkInternalSnapshot,
  setInternalSnapshot,
  unlinkInternalSnapshot,
} from "../snapshot/internal"
import { tweak } from "../tweaker/tweak"
import { failure } from "../utils"
import { ModelMetadata, modelMetadataKey } from "./metadata"
import { modelInfoByClass } from "./modelInfo"

/**
 * @ignore
 */
export interface ModelInitData {
  uuid: string
}

let modelInitData: ModelInitData | undefined

/**
 * @ignore
 */
export function createModelWithUuid<T extends AnyModel>(
  modelClass: new (initialData: ModelCreationData<T>) => T,
  initialData: ModelCreationData<T>,
  uuid: string
): T {
  modelInitData = {
    uuid,
  }

  try {
    return new modelClass(initialData)
  } finally {
    modelInitData = undefined
  }
}

declare const typeSymbol: unique symbol

/**
 * Base abstract class for models.
 * Never override the derived constructor, use `onInit` or `onAttachedToRootStore` instead.
 *
 * @typeparam RequiredData Required data type.
 * @typeparam OptionalData Optional data type.
 */
export abstract class Model<
  RequiredData extends { [k: string]: any },
  OptionalData extends { [k: string]: any }
> {
  // just to make typing work properly
  [typeSymbol]: [RequiredData, OptionalData];

  readonly [modelMetadataKey]: Readonly<ModelMetadata>

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
  abstract getDefaultData(): Readonly<OptionalData>

  /**
   * Data part of the model, which is observable and will be serialized in snapshots.
   * It must be an object.
   */
  readonly data!: RequiredData & OptionalData

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
  onAttachedToRootStore?(rootStore: AnyModel): (() => void) | void

  /**
   * Optional transformation that will be run when converting from a snapshot to the data part of the model.
   * Useful for example to do versioning and keep the data part up to date with the latest version of the model.
   *
   * @param snapshot
   * @returns
   */
  fromSnapshot?(snapshot: any): any

  constructor(initialData: RequiredData & Partial<OptionalData>) {
    const modelInfo = modelInfoByClass.get(this.constructor)!
    let id
    if (modelInitData) {
      id = modelInitData.uuid
      modelInitData = undefined
    } else {
      id = uuidV4()
    }
    this[modelMetadataKey] = {
      type: modelInfo.name,
      id,
    }

    tweak(this, undefined)

    let obsData: any

    Object.defineProperty(this, "data", {
      configurable: true,
      enumerable: true,
      get() {
        return obsData
      },
      set(value: any) {
        const oldObsData = obsData
        obsData = tweak(value, { parent: this, path: "data" })

        if (oldObsData !== obsData) {
          const oldSn = getInternalSnapshot(oldObsData)
          const newSn = getInternalSnapshot(obsData)
          if (oldSn !== newSn) {
            if (oldSn) {
              const patchRecorder = new InternalPatchRecorder()

              const standard = produce(
                oldSn.standard,
                (draftStandard: any) => {
                  delete draftStandard[modelMetadataKey]
                },
                patchRecorder.record
              )

              // detach old (should be detached already though)
              tweak(oldObsData, undefined)

              unlinkInternalSnapshot(this)
              setInternalSnapshot(oldObsData, standard, patchRecorder)
            }

            if (newSn) {
              const patchRecorder = new InternalPatchRecorder()

              const standard = produce(
                newSn.standard,
                (draftStandard: any) => {
                  draftStandard[modelMetadataKey] = this[modelMetadataKey]
                },
                patchRecorder.record
              )

              // make the model use the inner data field snapshot
              linkInternalSnapshot(this, newSn)
              setInternalSnapshot(obsData, standard, patchRecorder)
            }
          }
        }
      },
    })

    const initializers = modelClassInitializers.get(this.constructor as any)
    if (initializers) {
      initializers.forEach(init => init(this))
    }

    runUnprotected(() => {
      // set initial data
      ;(this.data as any) = initialData

      // fill in defaults if not in initial data
      if (this.getDefaultData) {
        const defaultData = this.getDefaultData()
        for (const [k, v] of Object.entries(defaultData)) {
          if (!(k in initialData)) {
            ;(this.data as any)[k] = v
          }
        }
      }
    })

    if (!modelInitData && this.onInit) {
      this.onInit()
    }
  }
}

/**
 * Any kind of model instance.
 */
export type AnyModel = Model<any, any>

/**
 * Type of the model class.
 */
export type ModelClass = typeof Model

/**
 * The creation data of a model.
 */
export type ModelCreationData<M extends AnyModel> = M extends Model<infer R, infer O>
  ? R & Partial<O>
  : never

/**
 * The data type of a model.
 */
export type ModelData<M extends AnyModel> = M["data"]

type ModelClassInitializer = (modelInstance: AnyModel) => void

const modelClassInitializers = new WeakMap<ModelClass, ModelClassInitializer[]>()

/**
 * @ignore
 */
export function addModelClassInitializer(modelClass: ModelClass, init: ModelClassInitializer) {
  let initializers = modelClassInitializers.get(modelClass)
  if (!initializers) {
    initializers = []
    modelClassInitializers.set(modelClass, initializers)
  }
  initializers.push(init)
}

export function checkModelDecoratorArgs(fnName: string, target: any, propertyKey: string) {
  if (typeof propertyKey !== "string") {
    throw failure(fnName + " cannot be used over symbol properties")
  }

  const errMessage = fnName + " must be used over model classes or instances"

  if (!target) {
    throw failure(errMessage)
  }

  // check target is a model object or extended class
  if (!(target instanceof Model) && target !== Model && !(target.prototype instanceof Model)) {
    throw failure(errMessage)
  }
}

/**
 * @ignore
 *
 * Asserts something is actually a model.
 *
 * @param model
 * @param argName
 */
export function assertIsModel(model: AnyModel, argName: string) {
  if (!(model instanceof Model)) {
    throw failure(`${argName} must be a model instance`)
  }
}
