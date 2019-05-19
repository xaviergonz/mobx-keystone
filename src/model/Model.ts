import { typeofKey } from "../snapshot/metadata"
import { modelInfoByClass } from "./modelInfo"
import { tweak } from "../tweaker/tweak"
import {
  getInternalSnapshot,
  setInternalSnapshot,
  unlinkInternalSnapshot,
  linkInternalSnapshot,
} from "../snapshot/internal"
import produce from "immer"

export abstract class Model {
  readonly [typeofKey]: string

  abstract data: object

  attachedToRootStore?(rootStore: object): (() => void) | void

  constructor() {
    const modelInfo = modelInfoByClass.get(this.constructor)!
    this[typeofKey] = modelInfo.name

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
              let standard: any, pureJson: any
              standard = produce(oldSn.standard, (draftStandard: any) => {
                pureJson = produce(oldSn.pureJson, (draftPureJson: any) => {
                  delete draftStandard[typeofKey]
                  delete draftPureJson[typeofKey]
                })
              })

              setInternalSnapshot(oldObsData, standard, pureJson)

              unlinkInternalSnapshot(this)
            }

            if (newSn) {
              let standard: any, pureJson: any
              standard = produce(newSn.standard, (draftStandard: any) => {
                pureJson = produce(newSn.pureJson, (draftPureJson: any) => {
                  draftStandard[typeofKey] = modelInfo.name
                  draftPureJson[typeofKey] = modelInfo.name
                })
              })

              setInternalSnapshot(obsData, standard, pureJson)

              // make the model use the inner data field snapshot
              linkInternalSnapshot(this, newSn)
            }
          }
        }
      },
    })
  }
}

export type ModelClass = typeof Model
