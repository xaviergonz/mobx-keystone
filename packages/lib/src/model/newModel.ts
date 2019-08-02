import { action, observable } from "mobx"
import nanoid from "nanoid/non-secure"
import { O } from "ts-toolbelt"
import { HookAction } from "../action/hookActions"
import { wrapModelMethodInActionIfNeeded } from "../action/wrapInAction"
import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import { getInternalSnapshot, linkInternalSnapshot } from "../snapshot/internal"
import { tweakModel } from "../tweaker/tweakModel"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { assertIsObject, makePropReadonly } from "../utils"
import { getModelDataType } from "./getModelDataType"
import { modelMetadataKey } from "./metadata"
import { AnyModel, ModelClass } from "./Model"
import { modelConstructorSymbol, modelInfoByClass } from "./modelInfo"
import { assertIsModelClass } from "./utils"

/**
 * The creation data of a model.
 */
export type ModelCreationData<M extends AnyModel> = O.Optional<M["$"], keyof M["defaultData"]>

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
          id: string
          snapshotToInitialData(processedSnapshot: any): any
        }
      | undefined
  ): M => {
    assertIsModelClass(modelClass, "modelClass")

    const modelObj = new modelClass(modelConstructorSymbol) as O.Writable<M>

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
      const defaultDataKeys = Object.keys(defaultData as any)
      const defaultDataKeysLen = defaultDataKeys.length
      for (let i = 0; i < defaultDataKeysLen; i++) {
        const k = defaultDataKeys[i]
        if ((initialData as any)[k] === undefined) {
          ;(initialData as any)[k] = defaultData[k]
        }
      }
    }

    tweakModel(modelObj, undefined)

    // create observable data object with initial data

    let obsData = tweakPlainObject(
      initialData,
      { parent: modelObj, path: "$" },
      modelObj[modelMetadataKey],
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
