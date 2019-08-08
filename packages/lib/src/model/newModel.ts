import { action, observable } from "mobx"
import { O } from "ts-toolbelt"
import { HookAction } from "../action/hookActions"
import { wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { getInternalSnapshot, linkInternalSnapshot } from "../snapshot/internal"
import { tweakModel } from "../tweaker/tweakModel"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { assertIsObject, failure, makePropReadonly } from "../utils"
import { AnyModel, ModelClass, ModelCreationData } from "./BaseModel"
import { getModelDataType } from "./getModelDataType"
import { modelTypeKey } from "./metadata"
import { modelConstructorSymbol, modelInfoByClass } from "./modelInfo"
import { modelPropertiesSymbol } from "./modelSymbols"
import { ModelProps } from "./prop"
import { assertIsModelClass } from "./utils"

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
          snapshotToInitialData(processedSnapshot: any): any
        }
      | undefined
  ): M => {
    assertIsModelClass(modelClass, "modelClass")

    const modelObj = new modelClass(modelConstructorSymbol) as O.Writable<M>

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
        ;(initialData as any)[k] = newValue
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
    makePropReadonly(modelObj, "$", true)

    // type check it if needed
    if (isModelAutoTypeCheckingEnabled() && getModelDataType(modelClass)) {
      const err = modelObj.typeCheck()
      if (err) {
        err.throw(modelObj)
      }
    }

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
