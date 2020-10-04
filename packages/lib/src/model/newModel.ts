import { action, set } from "mobx"
import { O } from "ts-toolbelt"
import { getGlobalConfig, isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { tweakModel } from "../tweaker/tweakModel"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { failure, inDevMode, makePropReadonly } from "../utils"
import { AnyModel, ModelClass, ModelPropsCreationData } from "./BaseModel"
import { getModelDataType } from "./getModelDataType"
import { modelIdKey, modelTypeKey } from "./metadata"
import { ModelConstructorOptions } from "./ModelConstructorOptions"
import { modelInfoByClass } from "./modelInfo"
import { getInternalModelClassPropsInfo } from "./modelPropsInfo"
import { modelInitializersSymbol } from "./modelSymbols"
import { noDefaultValue } from "./prop"
import { assertIsModelClass } from "./utils"

/**
 * @ignore
 */
export const internalNewModel = action(
  "newModel",
  <M extends AnyModel>(
    origModelObj: M,
    initialData: (ModelPropsCreationData<M> & { [modelIdKey]?: string }) | undefined,
    options: Pick<ModelConstructorOptions, "modelClass" | "snapshotInitialData" | "generateNewIds">
  ): M => {
    const { modelClass: _modelClass, snapshotInitialData, generateNewIds } = options
    const modelClass = _modelClass!

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

      if (generateNewIds) {
        id = getGlobalConfig().modelIdGenerator()
      } else {
        id = sn[modelIdKey]
      }

      if (modelObj.fromSnapshot) {
        sn = modelObj.fromSnapshot(sn)
      }

      initialData = snapshotInitialData.snapshotToInitialData(sn)
    } else {
      // use symbol if provided
      if (initialData![modelIdKey]) {
        id = initialData![modelIdKey]
      } else {
        id = getGlobalConfig().modelIdGenerator()
      }
    }

    modelObj[modelTypeKey] = modelInfo.name

    // fill in defaults in initial data
    const modelProps = getInternalModelClassPropsInfo(modelClass)
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

    set(initialData as any, modelIdKey, id)

    tweakModel(modelObj, undefined)

    // create observable data object with initial data
    let obsData = tweakPlainObject(
      initialData!,
      { parent: modelObj, path: "$" },
      modelObj[modelTypeKey],
      false,
      true
    )

    // hide $.$modelId
    Object.defineProperty(obsData, modelIdKey, {
      ...Object.getOwnPropertyDescriptor(obsData, modelIdKey),
      enumerable: false,
    })

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
