import { action, set } from "mobx"
import type { O } from "ts-toolbelt"
import {
  DeepChangeType,
  emitDeepChange,
  ObjectAddChange,
  ObjectUpdateChange,
} from "../deepChange/onDeepChange"
import { isModelAutoTypeCheckingEnabled } from "../globalConfig/globalConfig"
import type { ModelClass, ModelCreationData } from "../modelShared/BaseModelShared"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { getInternalModelClassPropsInfo } from "../modelShared/modelPropsInfo"
import { applyModelInitializers } from "../modelShared/newModel"
import { getModelPropDefaultValue, noDefaultValue } from "../modelShared/prop"
import { createPatchForObjectValueChange, emitPatches } from "../patch/emitPatch"
import { Patch } from "../patch/Patch"
import { tweakModel } from "../tweaker/tweakModel"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { failure, inDevMode, makePropReadonly } from "../utils"
import { setIfDifferent, setIfDifferentWithReturn } from "../utils/setIfDifferent"
import type { AnyModel } from "./BaseModel"
import { getModelIdPropertyName } from "./getModelMetadata"
import type { ModelConstructorOptions } from "./ModelConstructorOptions"
import { modelTypeKey } from "./metadata"
import { assertIsModelClass } from "./utils"

/**
 * @internal
 */
export const internalNewModel = action(
  "newModel",
  <M extends AnyModel>(
    origModelObj: M,
    initialData: ModelCreationData<M>,
    modelClass: ModelClass<AnyModel>
  ): void => {
    if (inDevMode) {
      assertIsModelClass(modelClass, "modelClass")
    }

    const { modelInfo, modelIdPropertyName, modelProps, modelIdPropData } =
      getModelDetails(modelClass)

    // use symbol if provided
    if (modelIdPropertyName && modelIdPropData) {
      let id: string | undefined
      if (initialData[modelIdPropertyName]) {
        id = initialData[modelIdPropertyName]
      } else {
        id = (modelIdPropData._defaultFn as () => string)()
      }
      setIfDifferent(initialData, modelIdPropertyName, id)
    }

    const modelObj = origModelObj as O.Writable<M>
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

      const initialValue = initialData[k]
      let newValue = initialValue
      let changed = false

      // apply untransform (if any) if not in snapshot mode
      if (propData._transform) {
        changed = true
        newValue = propData._transform.untransform(newValue, modelObj, k)
      }

      // apply default value (if needed)
      if (newValue == null) {
        const defaultValue = getModelPropDefaultValue(propData)
        if (defaultValue !== noDefaultValue) {
          changed = true
          newValue = defaultValue
        } else if (!(k in initialData)) {
          // for mobx4, we need to set up properties even if they are undefined
          changed = true
        }
      }

      if (changed) {
        // setIfDifferent not required
        set(initialData, k, newValue)
      }
    }

    finalizeNewModel(modelObj, initialData, modelClass)

    // type check it if needed
    if (isModelAutoTypeCheckingEnabled()) {
      const err = modelObj.typeCheck()
      if (err) {
        err.throw()
      }
    }
  }
)

/**
 * @internal
 */
export const internalFromSnapshotModel = action(
  "fromSnapshotModel",
  <M extends AnyModel>(
    origModelObj: M,
    snapshotInitialData: NonNullable<ModelConstructorOptions["snapshotInitialData"]>,
    modelClass: ModelClass<AnyModel>,
    generateNewIds: boolean
  ): void => {
    if (inDevMode) {
      assertIsModelClass(modelClass, "modelClass")
    }

    const { modelInfo, modelIdPropertyName, modelProps, modelIdPropData } =
      getModelDetails(modelClass)

    let id: string | undefined
    let sn = snapshotInitialData.unprocessedSnapshot

    if (modelIdPropData && modelIdPropertyName) {
      if (generateNewIds) {
        id = (modelIdPropData._defaultFn as () => string)()
      } else {
        id = sn[modelIdPropertyName]
      }
    }

    if (modelClass.fromSnapshotProcessor) {
      sn = modelClass.fromSnapshotProcessor(sn)
    }

    const initialData = snapshotInitialData.snapshotToInitialData(sn)

    const modelObj = origModelObj as O.Writable<M>
    modelObj[modelTypeKey] = modelInfo.name

    const patches: Patch[] = []
    const inversePatches: Patch[] = []
    const defaultsApplied: { key: string; oldValue: unknown; newValue: unknown }[] = []

    if (modelIdPropertyName) {
      const initialValue = initialData[modelIdPropertyName]
      const valueChanged = setIfDifferentWithReturn(initialData, modelIdPropertyName, id)

      if (valueChanged) {
        const modelIdPath = [modelIdPropertyName]

        patches.push(createPatchForObjectValueChange(modelIdPath, initialValue, id))
        inversePatches.push(createPatchForObjectValueChange(modelIdPath, id, initialValue))
      }
    }

    // fill in defaults in initial data
    const modelPropsKeys = Object.keys(modelProps)
    for (let i = 0; i < modelPropsKeys.length; i++) {
      const k = modelPropsKeys[i]

      // id is already initialized above
      if (k === modelIdPropertyName) {
        continue
      }

      const propData = modelProps[k]

      const initialValue = initialData[k]
      let newValue = initialValue
      let changed = false

      // apply default value (if needed)
      if (newValue == null) {
        const defaultValue = getModelPropDefaultValue(propData)
        if (defaultValue !== noDefaultValue) {
          changed = true
          newValue = defaultValue
        } else if (!(k in initialData!)) {
          // for mobx4, we need to set up properties even if they are undefined
          changed = true
        }
      }

      if (changed) {
        // setIfDifferent not required
        set(initialData, k, newValue)

        if (newValue !== initialValue) {
          const propPath = [k]

          patches.push(createPatchForObjectValueChange(propPath, initialValue, newValue))
          inversePatches.push(createPatchForObjectValueChange(propPath, newValue, initialValue))

          // Track defaults applied for deep change emission
          defaultsApplied.push({ key: k, oldValue: initialValue, newValue })
        }
      }
    }

    // also emit a patch for modelType, since it will get included in the snapshot
    const initialModelType = snapshotInitialData?.unprocessedModelType
    const newModelType = modelInfo.name
    if (initialModelType !== newModelType) {
      const modelTypePath = [modelTypeKey]

      patches.push(createPatchForObjectValueChange(modelTypePath, initialModelType, newModelType))
      inversePatches.push(
        createPatchForObjectValueChange(modelTypePath, newModelType, initialModelType)
      )
    }

    finalizeNewModel(modelObj, initialData, modelClass)

    emitPatches(modelObj, patches, inversePatches)

    // Emit deep changes for defaults applied during fromSnapshot
    // These are emitted with isInit: true so bindings can sync them to CRDTs
    for (const { key, oldValue } of defaultsApplied) {
      const target = modelObj.$
      if (oldValue === undefined) {
        // Key was added (didn't exist in snapshot)
        const change: ObjectAddChange = {
          type: DeepChangeType.ObjectAdd,
          path: [],
          target,
          key,
          newValue: target[key], // Use the tweaked value from $
          isInit: true,
        }
        emitDeepChange(modelObj, change)
      } else {
        // Key was updated (had a different value in snapshot, e.g., null -> default)
        const change: ObjectUpdateChange = {
          type: DeepChangeType.ObjectUpdate,
          path: [],
          target,
          key,
          newValue: target[key], // Use the tweaked value from $
          oldValue,
          isInit: true,
        }
        emitDeepChange(modelObj, change)
      }
    }

    // type check it if needed
    if (isModelAutoTypeCheckingEnabled()) {
      const err = modelObj.typeCheck()
      if (err) {
        err.throw()
      }
    }
  }
)

function getModelDetails(modelClass: ModelClass<AnyModel>) {
  const modelInfo = modelInfoByClass.get(modelClass)
  if (!modelInfo) {
    throw failure(
      `no model info for class ${modelClass.name} could be found - did you forget to add the @model decorator?`
    )
  }

  const modelIdPropertyName = getModelIdPropertyName(modelClass)
  const modelProps = getInternalModelClassPropsInfo(modelClass)
  const modelIdPropData = modelIdPropertyName ? modelProps[modelIdPropertyName] : undefined

  return { modelInfo, modelIdPropertyName, modelProps, modelIdPropData }
}

function finalizeNewModel(
  modelObj: O.Writable<AnyModel>,
  initialData: any,
  modelClass: ModelClass<AnyModel>
) {
  tweakModel(modelObj, undefined)

  // create observable data object with initial data
  modelObj.$ = tweakPlainObject(
    initialData,
    { parent: modelObj, path: "$" },
    modelObj[modelTypeKey],
    false,
    true
  )

  if (inDevMode) {
    makePropReadonly(modelObj, "$", true)
  }

  // run any extra initializers for the class as needed
  applyModelInitializers(modelClass, modelObj)
}
