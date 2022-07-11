import { action } from "mobx"
import type { O } from "ts-toolbelt"
import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import type { ModelUntransformedData } from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { applyModelInitializers } from "../modelShared/newModel"
import { failure, inDevMode, makePropReadonly } from "../utils"
import type { AnyDataModel } from "./BaseDataModel"
import type { DataModelConstructorOptions } from "./DataModelConstructorOptions"
import { getDataModelMetadata } from "./getDataModelMetadata"
import { assertIsDataModelClass } from "./utils"

/**
 * @internal
 */
export const internalNewDataModel = action(
  "newModel",
  <M extends AnyDataModel>(
    origModelObj: M,
    tweakedData: ModelUntransformedData<M>,
    options: Pick<DataModelConstructorOptions, "modelClass">
  ): M => {
    const { modelClass: _modelClass } = options
    const modelClass = _modelClass!

    if (inDevMode()) {
      assertIsDataModelClass(modelClass, "modelClass")
    }

    const modelObj = origModelObj as O.Writable<M>

    const modelInfo = modelInfoByClass.get(modelClass)
    if (!modelInfo) {
      throw failure(
        `no model info for class ${modelClass.name} could be found - did you forget to add the @model decorator?`
      )
    }

    // link it, and make it readonly
    modelObj.$ = tweakedData
    if (inDevMode()) {
      makePropReadonly(modelObj, "$", true)
    }

    // type check it if needed
    if (isModelAutoTypeCheckingEnabled() && getDataModelMetadata(modelClass).dataType) {
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
