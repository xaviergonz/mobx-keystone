import { action, remove, set } from "mobx"
import { O } from "ts-toolbelt"
import { getGlobalConfig, isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { tweakModel } from "../tweaker/tweakModel"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { failure, inDevMode, makePropReadonly } from "../utils"
import { AnyModel, ModelClass, ModelCreationData } from "./BaseModel"
import { getModelDataType } from "./getModelDataType"
import { modelId, modelIdKey, modelTypeKey } from "./metadata"
import { modelInfoByClass } from "./modelInfo"
import { modelInitializersSymbol, modelPropertiesSymbol } from "./modelSymbols"
import { ModelProps, noDefaultValue } from "./prop"
import { assertIsModelClass } from "./utils"

/**
 * @ignore
 */
export const internalNewModel = action(
  "newModel",
  <M extends AnyModel>(
    origModelObj: M,
    modelClass: ModelClass<M>,
    initialData: (ModelCreationData<M> & { [modelId]?: string }) | undefined,
    snapshotInitialData:
      | {
          unprocessedSnapshot: any
          snapshotToInitialData(processedSnapshot: any): any
        }
      | undefined,
    generateNewId: boolean
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

    let id
    if (snapshotInitialData) {
      let sn = snapshotInitialData.unprocessedSnapshot

      id = generateNewId ? getGlobalConfig().modelIdGenerator() : sn[modelIdKey]

      if (modelObj.fromSnapshot) {
        sn = modelObj.fromSnapshot(sn)
      }

      initialData = snapshotInitialData.snapshotToInitialData(sn)
    } else {
      // use symbol if provided
      if (initialData![modelId]) {
        id = initialData![modelId]

        // make sure the model ID symbol does not get through to $
        // initialData will always be an observable object already
        remove(initialData as any, modelId)
      } else {
        id = getGlobalConfig().modelIdGenerator()
      }
    }

    modelObj[modelTypeKey] = modelInfo.name
    modelObj[modelIdKey] = id

    // fill in defaults in initial data
    const modelProps: ModelProps = (modelClass as any)[modelPropertiesSymbol]
    const modelPropsKeys = Object.keys(modelProps)
    for (let i = 0; i < modelPropsKeys.length; i++) {
      const k = modelPropsKeys[i]
      const v = (initialData as any)[k]
      if (v === undefined || v === null) {
        let newValue: any = v
        const propData = modelProps[k]
        if (propData.defaultFn !== noDefaultValue) {
          newValue = propData.defaultFn()
        } else if (propData.defaultValue !== noDefaultValue) {
          newValue = propData.defaultValue
        }
        set(initialData as any, k, newValue)
      }
    }

    tweakModel(modelObj, undefined)

    // create observable data object with initial data
    let obsData = tweakPlainObject(
      initialData!,
      { parent: modelObj, path: "$" },
      modelObj[modelTypeKey],
      modelObj[modelIdKey],
      false,
      true
    )

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

    return modelObj as M
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
