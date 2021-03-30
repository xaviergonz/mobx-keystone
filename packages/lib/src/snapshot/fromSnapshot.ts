import { action, observable, set } from "mobx"
import type { AnyModel } from "../model/BaseModel"
import { isReservedModelKey } from "../model/metadata"
import { failure, isMap, isPrimitive, isSet } from "../utils"
import type { SnapshotInOf, SnapshotInOfModel, SnapshotOutOf } from "./SnapshotOf"

/**
 * @ignore
 * @internal
 */
export type Snapshotter = (sn: any, ctx: FromSnapshotContext) => any | undefined

const snapshotters: { priority: number; snapshotter: Snapshotter }[] = []

/**
 * @ignore
 * @internal
 */
export function registerSnapshotter(priority: number, snapshotter: Snapshotter): void {
  snapshotters.push({ priority, snapshotter })
  snapshotters.sort((a, b) => a.priority - b.priority)
}

/**
 * From snapshot options.
 */
export interface FromSnapshotOptions {
  /**
   * Pass `true` to generate new internal ids for models rather than reusing them. (Default is `false`)
   */
  generateNewIds: boolean
}

/**
 * @ignore
 * @internal
 */
export interface FromSnapshotContext {
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

/**
 * @ignore
 * @internal
 */
export function internalFromSnapshot<T>(
  sn: SnapshotInOf<T> | SnapshotOutOf<T>,
  ctx: FromSnapshotContext
): T {
  if (isPrimitive(sn)) {
    return sn as any
  }

  const snapshotterLen = snapshotters.length
  for (let i = 0; i < snapshotterLen; i++) {
    const { snapshotter } = snapshotters[i]
    const ret = snapshotter(sn, ctx)
    if (ret !== undefined) {
      return ret
    }
  }

  if (isMap(sn)) {
    throw failure("a snapshot must not contain maps")
  }

  if (isSet(sn)) {
    throw failure("a snapshot must not contain sets")
  }

  throw failure(`unsupported snapshot - ${sn}`)
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

export const observableOptions = {
  deep: false,
}
