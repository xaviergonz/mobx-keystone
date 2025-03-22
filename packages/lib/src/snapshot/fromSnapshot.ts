import { action, observable, set } from "mobx"
import type { AnyDataModel } from "../dataModel/BaseDataModel"
import type { AnyModel } from "../model/BaseModel"
import { isReservedModelKey } from "../model/metadata"
import { isModelClass } from "../model/utils"
import type { ModelClass } from "../modelShared/BaseModelShared"
import { TypeChecker, isLateTypeChecker } from "../types/TypeChecker"
import { resolveTypeChecker } from "../types/resolveTypeChecker"
import type { AnyStandardType, TypeToData } from "../types/schemas"
import { failure, isMap, isPrimitive, isSet } from "../utils"
import type { SnapshotInOf, SnapshotInOfModel, SnapshotOutOf } from "./SnapshotOf"
import { registerDefaultSnapshotters } from "./registerDefaultSnapshotters"

/**
 * @internal
 */
export type Snapshotter = (sn: any, ctx: FromSnapshotContext) => any

const snapshotters: { priority: number; snapshotter: Snapshotter }[] = []

/**
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
 * @internal
 */
export interface FromSnapshotContext {
  options: FromSnapshotOptions
  snapshotToInitialData: (processedSn: SnapshotInOfModel<AnyModel>) => any
  untypedSnapshot: unknown
}

/**
 * Given a type deserializes a data structure from its snapshot form.
 *
 * @template TType Object type.
 * @param type Type.
 * @param snapshot Snapshot, even if a primitive.
 * @param options Options.
 * @returns The deserialized object.
 */
export function fromSnapshot<
  TType extends AnyStandardType | ModelClass<AnyModel> | ModelClass<AnyDataModel>,
>(
  type: TType,
  snapshot: SnapshotInOf<TypeToData<TType>>,
  options?: Partial<FromSnapshotOptions>
): TypeToData<TType>

/**
 * Deserializes a data structure from its snapshot form.
 *
 * @template T Object type.
 * @param snapshot Snapshot, even if a primitive.
 * @param options Options.
 * @returns The deserialized object.
 */
export function fromSnapshot<T>(
  snapshot: SnapshotInOf<T> | SnapshotOutOf<T>,
  options?: Partial<FromSnapshotOptions>
): T

export function fromSnapshot<T>(arg1: any, arg2: any, arg3?: any): T {
  let snapshot: any
  let unprocessedSnapshot: unknown
  let options: Partial<FromSnapshotOptions> | undefined

  if (isLateTypeChecker(arg1) || arg1 instanceof TypeChecker || isModelClass(arg1)) {
    const typeChecker = resolveTypeChecker(arg1)
    unprocessedSnapshot = arg2
    snapshot = typeChecker.fromSnapshotProcessor(unprocessedSnapshot)
    options = arg3
  } else {
    snapshot = arg1
    unprocessedSnapshot = snapshot
    options = arg2
  }

  return fromSnapshotAction(snapshot, unprocessedSnapshot, options)
}

const fromSnapshotAction = action(
  "fromSnapshot",
  <T>(
    snapshot: SnapshotInOf<T>,
    unprocessedSnapshot: unknown,
    options: Partial<FromSnapshotOptions> | undefined
  ): T => {
    const opts = {
      generateNewIds: false,
      overrideRootModelId: undefined,
      ...options,
    }

    const ctx: Partial<FromSnapshotContext> = {
      options: opts,
      untypedSnapshot: unprocessedSnapshot,
    }
    ctx.snapshotToInitialData = snapshotToInitialData.bind(undefined, ctx as FromSnapshotContext)

    return internalFromSnapshot<T>(snapshot, ctx as FromSnapshotContext)
  }
)

/**
 * @internal
 */
export function internalFromSnapshot<T>(
  sn: SnapshotInOf<T> | SnapshotOutOf<T>,
  ctx: FromSnapshotContext
): T {
  if (isPrimitive(sn)) {
    return sn as any
  }

  registerDefaultSnapshotters()

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
      // setIfDifferent not required
      set(initialData, k, internalFromSnapshot(v, ctx))
    }
  }
  return initialData
}

export const observableOptions = {
  deep: false,
}
