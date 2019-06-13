import produce from "immer"
import { v4 as uuidV4 } from "uuid"
import { PatchRecorder } from "../patch/emitPatch"
import {
  getInternalSnapshot,
  linkInternalSnapshot,
  setInternalSnapshot,
  unlinkInternalSnapshot,
} from "../snapshot/internal"
import { modelIdKey, typeofKey } from "../snapshot/metadata"
import { tweak } from "../tweaker/tweak"
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
  readonly [typeofKey]: string;
  readonly [modelIdKey]: string

  /**
   * Gets the unique model ID of this model instance.
   *
   * @readonly
   */
  get modelId() {
    return this[modelIdKey]
  }

  /**
   * Data part of the model, which is observable and will be serialized in snapshots.
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
    this[typeofKey] = modelInfo.name
    if (modelInitData) {
      this[modelIdKey] = modelInitData.uuid
      modelInitData = undefined
    } else {
      this[modelIdKey] = uuidV4()
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
              const patchRecorder = new PatchRecorder()

              const standard = produce(
                oldSn.standard,
                (draftStandard: any) => {
                  delete draftStandard[typeofKey]
                  delete draftStandard[modelIdKey]
                },
                patchRecorder.record
              )

              // detach old (should be detached already though)
              tweak(oldObsData, undefined)

              unlinkInternalSnapshot(this)
              setInternalSnapshot(oldObsData, standard, patchRecorder)
            }

            if (newSn) {
              const patchRecorder = new PatchRecorder()

              const standard = produce(
                newSn.standard,
                (draftStandard: any) => {
                  draftStandard[typeofKey] = this[typeofKey]
                  draftStandard[modelIdKey] = this[modelIdKey]
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
  }
}

export type ModelClass = typeof Model
