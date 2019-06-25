import nanoid from "nanoid/non-secure"
import { Writable } from "ts-essentials"
import { isFrozenSnapshot } from "../frozen/Frozen"
import { isReservedModelKey, modelMetadataKey } from "../model/metadata"
import { AnyModel } from "../model/Model"
import { getModelInfoForName } from "../model/modelInfo"
import { isModelSnapshot } from "../model/utils"
import { Ref } from "../ref/Ref"
import { failure, isArray, isMap, isPlainObject, isPrimitive, isSet } from "../utils"
import {
  SnapshotInOf,
  SnapshotInOfArray,
  SnapshotInOfModel,
  SnapshotInOfObject,
} from "./SnapshotOf"

interface FixSnapshotIdsContext {
  idMap: Map<string, string>
  refs: Writable<SnapshotInOf<Ref<any>>>[]
}

/**
 * @ignore
 */
export function fixSnapshotIds<T>(sn: T): T {
  const ctx: FixSnapshotIdsContext = {
    idMap: new Map(),
    refs: [],
  }
  const newSn = internalFixSnapshotIds(sn, ctx)

  // update ref ids
  ctx.refs.forEach(ref => {
    ref.id = ctx.idMap.get(ref.id) || ref.id
  })

  return newSn
}

function internalFixSnapshotIds<T>(sn: T, ctx: FixSnapshotIdsContext): T {
  if (isPrimitive(sn)) {
    return sn as any
  }

  if (isMap(sn)) {
    throw failure("a snapshot might not contain maps")
  }

  if (isSet(sn)) {
    throw failure("a snapshot might not contain sets")
  }

  if (isArray(sn)) {
    return fixArraySnapshotIds(sn, ctx) as any
  }

  if (isFrozenSnapshot(sn)) {
    // nothing to do, since frozen cannot contain models
    return sn
  }

  if (isModelSnapshot(sn)) {
    return fixModelSnapshotIds(sn, ctx) as any
  }

  if (isPlainObject(sn)) {
    return fixPlainObjectSnapshotIds(sn, ctx) as any
  }

  throw failure(`unsupported snapshot - ${sn}`)
}

function fixArraySnapshotIds(sn: SnapshotInOfArray<any>, ctx: FixSnapshotIdsContext): any[] {
  return sn.map(v => internalFixSnapshotIds(v, ctx))
}

function fixModelSnapshotIds(
  sn: SnapshotInOfModel<AnyModel>,
  ctx: FixSnapshotIdsContext
): AnyModel {
  const { type, id } = sn[modelMetadataKey]

  if (!id) {
    throw failure(
      `a model a snapshot must contain an id (${modelMetadataKey}.id) key, but none was found`
    )
  }

  const modelInfo = getModelInfoForName(type)
  if (!modelInfo) {
    throw failure(`model with name "${type}" not found in the registry`)
  }

  const newId = nanoid()
  ctx.idMap.set(id, newId)

  const modelSn: any = {
    [modelMetadataKey]: {
      id: newId,
      type,
    },
  }
  for (const [k, v] of Object.entries(sn)) {
    if (!isReservedModelKey(k)) {
      modelSn[k] = internalFixSnapshotIds(v, ctx)
    }
  }

  if (modelInfo.class === Ref) {
    ctx.refs.push(modelSn)
  }

  return modelSn
}

function fixPlainObjectSnapshotIds(
  sn: SnapshotInOfObject<any>,
  ctx: FixSnapshotIdsContext
): object {
  const plainObj: any = {}
  for (const [k, v] of Object.entries(sn)) {
    plainObj[k] = internalFixSnapshotIds(v, ctx)
  }
  return plainObj
}
