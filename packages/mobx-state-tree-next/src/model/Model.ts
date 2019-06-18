import produce from "immer"
import { v4 as uuidV4 } from "uuid"
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

export interface ModelInitData {
  uuid: string
}

let modelInitData: ModelInitData | undefined

export function createModelWithUuid<T extends Model>(modelClass: new () => T, uuid: string): T {
  modelInitData = {
    uuid,
  }

  try {
    return new modelClass()
  } finally {
    modelInitData = undefined
  }
}

/**
 * Base abtract class for models.
 */
export abstract class Model {
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
   * Data part of the model, which is observable and will be serialized in snapshots.
   * It must be an object.
   *
   * @abstract
   */
  abstract data: { [k: string]: any }

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
  onAttachedToRootStore?(rootStore: Model): (() => void) | void

  /**
   * Optional transformation that will be run when converting from a snapshot to the data part of the model.
   * Useful for example to do versioning and keep the data part up to date with the latest version of the model.
   *
   * @param snapshot
   * @returns
   */
  fromSnapshot?(snapshot: any): this["data"]

  constructor() {
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
  }
}

export type ModelClass = typeof Model

type ModelClassInitializer = (modelInstance: Model) => void
export const modelClassInitializers = new WeakMap<ModelClass, ModelClassInitializer[]>()

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
