import { action, observable, set } from "mobx"
import { frozen, isFrozenSnapshot } from "../frozen/Frozen"
import { AnyModel } from "../model/BaseModel"
import { isReservedModelKey, modelIdKey, modelTypeKey } from "../model/metadata"
import { ModelConstructorOptions } from "../model/ModelConstructorOptions"
import { getModelInfoForName } from "../model/modelInfo"
import { isModelSnapshot } from "../model/utils"
import { tweakArray } from "../tweaker/tweakArray"
import { tweakPlainObject } from "../tweaker/tweakPlainObject"
import { failure, isArray, isMap, isPlainObject, isPrimitive, isSet } from "../utils"
import { SnapshotInOf, SnapshotInOfModel, SnapshotInOfObject, SnapshotOutOf } from "./SnapshotOf"

/**
 * From snapshot options.
 */
export interface FromSnapshotOptions {
  /**
   * Pass `true` to generate new internal ids for models rather than reusing them. (Default is `false`)
   */
  generateNewIds: boolean
}

interface FromSnapshotContext {
  options: FromSnapshotOptions
  snapshotToInitialData(processedSn: SnapshotInOfModel<AnyModel>): any
}

/**
 * Deserializers a data structure from its snapshot form.
 *
 * @typeparam T Object type.
 * @param snapshot Snapshot, even if a primitive.
 * @param [options] Options.
 * @returns The deserialized object.
 */
export let fromSnapshot = <T>(
  snapshot: SnapshotInOf<T> | SnapshotOutOf<T>,
  options?: Partial<FromSnapshotOptions>
): T => {
  const opts = {
    generateNewIds: false,
    overrideRootModelId: undefined,
    ...options,
  }

  const ctx: Partial<FromSnapshotContext> = {
    options: opts,
  }
  ctx.snapshotToInitialData = snapshotToInitialData.bind(undefined, ctx as FromSnapshotContext)

  return internalFromSnapshot<T>(snapshot, ctx as FromSnapshotContext)
}
fromSnapshot = action("fromSnapshot", fromSnapshot) as any

function internalFromSnapshot<T>(
  sn: SnapshotInOf<T> | SnapshotOutOf<T>,
  ctx: FromSnapshotContext
): T {
  if (isPrimitive(sn)) {
    return sn as any
  }

  if (isMap(sn)) {
    throw failure("a snapshot must not contain maps")
  }

  if (isSet(sn)) {
    throw failure("a snapshot must not contain sets")
  }

  if (isArray(sn)) {
    return fromArraySnapshot(sn, ctx) as any
  }

  if (isFrozenSnapshot(sn)) {
    return frozen(sn.data) as any
  }

  if (isModelSnapshot(sn)) {
    return fromModelSnapshot(sn, ctx) as any
  }

  if (isPlainObject(sn)) {
    return fromPlainObjectSnapshot(sn, ctx) as any
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

function fromArraySnapshot(sn: SnapshotInOfObject<any>, ctx: FromSnapshotContext): any[] {
  const arr = observable.array([] as any[], observableOptions)
  const ln = sn.length
  for (let i = 0; i < ln; i++) {
    arr.push(internalFromSnapshot(sn[i], ctx))
  }
  return tweakArray(arr, undefined, true)
}

function fromModelSnapshot(sn: SnapshotInOfModel<AnyModel>, ctx: FromSnapshotContext): AnyModel {
  const type = sn[modelTypeKey]

  if (!type) {
    throw failure(`a model snapshot must contain a type key (${modelTypeKey}), but none was found`)
  }

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  if (!sn[modelIdKey]) {
    throw failure(`a model snapshot must contain an id key (${modelIdKey}), but none was found`)
  }

  return new (modelInfo.class as any)(undefined, {
    snapshotInitialData: {
      unprocessedSnapshot: sn,
      snapshotToInitialData: ctx.snapshotToInitialData,
    },
    generateNewIds: ctx.options.generateNewIds,
  } as ModelConstructorOptions)
}

function snapshotToInitialData(
  ctx: FromSnapshotContext,
  processedSn: SnapshotInOfModel<AnyModel>
): any {
  const initialData = observable.object({}, undefined, observableOptions)

  const processedSnKeys = Object.keys(processedSn)
  const processedSnKeysLen = processedSnKeys.length
  for (let i = 0; i < processedSnKeysLen; i++) {
    const k = processedSnKeys[i]
    if (!isReservedModelKey(k)) {
      const v = processedSn[k]
      set(initialData, k, internalFromSnapshot(v, ctx))
    }
  }
  return initialData
}

function fromPlainObjectSnapshot(sn: SnapshotInOfObject<any>, ctx: FromSnapshotContext): object {
  const plainObj = observable.object({}, undefined, observableOptions)

  const snKeys = Object.keys(sn)
  const snKeysLen = snKeys.length
  for (let i = 0; i < snKeysLen; i++) {
    const k = snKeys[i]
    const v = sn[k]
    set(plainObj, k, internalFromSnapshot(v, ctx))
  }
  return tweakPlainObject(plainObj, undefined, undefined, true, false)
}

const observableOptions = {
  deep: false,
}
