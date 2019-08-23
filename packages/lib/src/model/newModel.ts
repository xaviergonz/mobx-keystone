import { action, set } from "mobx"
import { O } from "ts-toolbelt"
import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { getInternalSnapshot, linkInternalSnapshot } from "../snapshot/internal"
import { tweakModel } from "../tweaker/tweakModel"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { failure, inDevMode, makePropReadonly } from "../utils"
import { AnyModel, ModelClass, ModelCreationData } from "./BaseModel"
import { getModelDataType } from "./getModelDataType"
import { modelTypeKey } from "./metadata"
import { modelInfoByClass } from "./modelInfo"
import { modelInitializersSymbol, modelPropertiesSymbol } from "./modelSymbols"
import { ModelProps } from "./prop"
import { assertIsModelClass } from "./utils"

/**
 * @ignore
 */
export const internalNewModel = action(
  "newModel",
  <M extends AnyModel>(
    origModelObj: M,
    modelClass: ModelClass<M>,
    initialData: ModelCreationData<M> | undefined,
    snapshotInitialData:
      | {
          unprocessedSnapshot: any
          snapshotToInitialData(processedSnapshot: any): any
        }
      | undefined
  ): M => {
    if (inDevMode()) {
      assertIsModelClass(modelClass, "modelClass")
    }

    const modelObj = origModelObj as O.Writable<M>

    const modelInfo = modelInfoByClass.get(modelClass)
    if (!modelInfo) {
      throw failure(
        `no model info for class ${modelClass.name} could be found - did you forget to add the @model decorator?`
      )
    }
    if (snapshotInitialData) {
      let sn = snapshotInitialData.unprocessedSnapshot
      if (modelObj.fromSnapshot) {
        sn = modelObj.fromSnapshot(sn)
      }
      initialData = snapshotInitialData.snapshotToInitialData(sn)
    }

    modelObj[modelTypeKey] = modelInfo.name

    // fill in defaults in initial data
    const modelProps: ModelProps = (modelObj as any)[modelPropertiesSymbol]
    const modelPropsKeys = Object.keys(modelProps)
    for (let i = 0; i < modelPropsKeys.length; i++) {
      const k = modelPropsKeys[i]
      if ((initialData as any)[k] === undefined) {
        let newValue: any = undefined
        const propData = modelProps[k]
        if (propData.defaultFn !== undefined) {
          newValue = propData.defaultFn()
        } else if (propData.defaultValue !== undefined) {
          newValue = propData.defaultValue
        }
        set(initialData as any, k, newValue)
      }
    }

    tweakModel(modelObj, undefined)

    // create observable data object with initial data

    let obsData = tweakPlainObject(
      initialData,
      { parent: modelObj, path: "$" },
      modelObj[modelTypeKey],
      false
    )
    const newSn = getInternalSnapshot(obsData as any)!

    // make the model use the inner data field snapshot
    linkInternalSnapshot(modelObj, newSn)

    // link it, and make it readonly
    modelObj.$ = obsData
    if (inDevMode()) {
      makePropReadonly(modelObj, "$", true)
    }

    // type check it if needed
    if (isModelAutoTypeCheckingEnabled() && getModelDataType(modelClass)) {
      const err = modelObj.typeCheck()
      if (err) {
        err.throw(modelObj)
      }
    }

    // run any extra initializers for the class as needed
    const initializers = getModelClassInitializers(modelClass)
    if (initializers) {
      const len = initializers.length
      for (let i = 0; i < len; i++) {
        const init = initializers[i]
        init(modelObj)
      }
    }

    return modelObj
  }
)

type ModelClassInitializer = (modelInstance: AnyModel) => void

/**
 * @ignore
 */
export function addModelClassInitializer(
  modelClass: ModelClass<AnyModel>,
  init: ModelClassInitializer
) {
  let initializers = (modelClass as any)[modelInitializersSymbol]
  if (!initializers) {
    initializers = []
    ;(modelClass as any)[modelInitializersSymbol] = initializers
  }
  initializers.push(init)
}

function getModelClassInitializers(
  modelClass: ModelClass<AnyModel>
): ModelClassInitializer[] | undefined {
  return (modelClass as any)[modelInitializersSymbol]
}
