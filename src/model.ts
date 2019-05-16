import { produce } from "immer"
import "reflect-metadata"
import { typeofKey } from "./metadata"
import {
  getInternalSnapshot,
  linkInternalSnapshot,
  setInternalSnapshot,
  unlinkInternalSnapshot,
} from "./snapshot/_internal"
import { tweak } from "./tweaker"
import { fail, isObject } from "./_utils"

export abstract class Model {
  readonly [typeofKey]: string

  abstract data: object

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

interface ModelInfo {
  name: string
  class: ModelClass
}
const modelInfoByName: {
  [name: string]: ModelInfo
} = {}
const modelInfoByClass = new Map<any, ModelInfo>()

export function getModelInfoForName(name: string): ModelInfo | undefined {
  return modelInfoByName[name]
}

export function getModelInfoForObject(obj: any): ModelInfo | undefined {
  if (!isObject(obj) || !obj[typeofKey]) {
    return undefined
  }
  return getModelInfoForName(obj[typeofKey])
}

export const model = (name: string) => (clazz: ModelClass) => {
  if (typeof clazz !== "function") {
    throw fail("class expected")
  }

  if (!(clazz.prototype instanceof Model)) {
    throw fail(`a model class must extend Model`)
  }

  if (modelInfoByName[name]) {
    throw fail(`a model with name "${name}" already exists`)
  }

  const modelInfo = {
    name,
    class: clazz,
  }

  modelInfoByName[name] = modelInfo
  modelInfoByClass.set(clazz, modelInfo)
}
