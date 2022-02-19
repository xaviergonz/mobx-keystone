import { action, set } from "mobx"
import type { O } from "ts-toolbelt"
import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import type { ModelTransformedCreationData } from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../modelShared/modelPropsInfo"
import { applyModelInitializers } from "../modelShared/newModel"
import { noDefaultValue } from "../modelShared/prop"
import { tweakModel } from "../tweaker/tweakModel"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { failure, inDevMode, makePropReadonly } from "../utils"
import type { AnyModel } from "./BaseModel"
import { getModelIdPropertyName, getModelMetadata } from "./getModelMetadata"
import { modelTypeKey } from "./metadata"
import type { ModelConstructorOptions } from "./ModelConstructorOptions"
import { assertIsModelClass } from "./utils"

/**
 * @internal
 */
export const internalNewModel = action(
  "newModel",
  <M extends AnyModel>(
    origModelObj: M,
    initialData: ModelTransformedCreationData<M> | undefined,
    options: Pick<ModelConstructorOptions, "modelClass" | "snapshotInitialData" | "generateNewIds">
  ): M => {
    const mode = initialData ? "new" : "fromSnapshot"
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

    const modelIdPropertyName = getModelIdPropertyName(modelClass)
    const modelProps = getInternalModelClassPropsInfo(modelClass)
    const modelIdPropData = modelIdPropertyName ? modelProps[modelIdPropertyName]! : undefined

    let id: string | undefined
    if (snapshotInitialData) {
      let sn = snapshotInitialData.unprocessedSnapshot

      if (modelIdPropData && modelIdPropertyName) {
        if (generateNewIds) {
          id = (modelIdPropData._internal.defaultFn as () => string)()
        } else {
          id = sn[modelIdPropertyName]
        }
      }

      if (modelClass.fromSnapshotProcessor) {
        sn = modelClass.fromSnapshotProcessor(sn)
      }

      initialData = snapshotInitialData.snapshotToInitialData(sn)
    } else {
      // use symbol if provided
      if (modelIdPropData && modelIdPropertyName) {
        if (initialData![modelIdPropertyName]) {
          id = initialData![modelIdPropertyName]
        } else {
          id = (modelIdPropData._internal.defaultFn as () => string)()
        }
      }
    }

    modelObj[modelTypeKey] = modelInfo.name

    // fill in defaults in initial data
    const modelPropsKeys = Object.keys(modelProps)
    for (let i = 0; i < modelPropsKeys.length; i++) {
      const k = modelPropsKeys[i]

      // id is already initialized above
      if (k === modelIdPropertyName) {
        continue
      }

      const propData = modelProps[k]

      let newValue = initialData![k]
      let changed = false

      // apply untransform (if any)
      if (mode === "new" && propData._internal.transform) {
        changed = true
        newValue = propData._internal.transform.untransform(newValue, modelObj, k)
      }

      // apply default value (if needed)
      if (newValue == null) {
        if (propData._internal.defaultFn !== noDefaultValue) {
          changed = true
          newValue = propData._internal.defaultFn()
        } else if (propData._internal.defaultValue !== noDefaultValue) {
          changed = true
          newValue = propData._internal.defaultValue
        } else if (!("k" in initialData!)) {
          // for mobx4, we need to set up properties even if they are undefined
          changed = true
        }
      }

      if (changed) {
        set(initialData as any, k, newValue)
      }
    }

    if (modelIdPropertyName) {
      set(initialData as any, modelIdPropertyName, id)
    }

    tweakModel(modelObj, undefined)

    // create observable data object with initial data
    let obsData = tweakPlainObject(
      initialData!,
      { parent: modelObj, path: "$" },
      modelObj[modelTypeKey],
      false,
      true
    )

    // link it, and make it readonly
    modelObj.$ = obsData
    if (inDevMode()) {
      makePropReadonly(modelObj, "$", true)
    }

    // type check it if needed
    if (isModelAutoTypeCheckingEnabled() && getModelMetadata(modelClass).dataType) {
      const err = modelObj.typeCheck()
      if (err) {
        err.throw(modelObj)
      }
    }

    // run any extra initializers for the class as needed
    applyModelInitializers(modelClass, modelObj)

    return modelObj as M
  }
)
