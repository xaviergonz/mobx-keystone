import { action, observable, set } from "mobx"
import type { AnyModel } from "../model/BaseModel"
import { isReservedModelKey } from "../model/metadata"
import { resolveTypeChecker } from "../types/resolveTypeChecker"
import type { AnyStandardType, TypeToData } from "../types/schemas"
import { isLateTypeChecker, TypeChecker } from "../types/TypeChecker"
import { failure, isMap, isPrimitive, isSet } from "../utils"
import type {
  SnapshotInOf,
  SnapshotInOfModel,
  SnapshotOutOf,
  _SnapshotInOf,
  _SnapshotOutOf,
} from "./SnapshotOf"

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
 * Given a type deserializes a data structure from its snapshot form.
 *
 * @typeparam TType Object type.
 * @param type Type.
 * @param snapshot Snapshot, even if a primitive.
 * @param options Options.
 * @returns The deserialized object.
 */
export function fromSnapshot<TType extends AnyStandardType>(
  type: TType,
  snapshot: SnapshotInOf<TypeToData<TType>>,
  options?: Partial<FromSnapshotOptions>
): TypeToData<TType>

/**
 * Deserializes a data structure from its snapshot form.
 *
 * @typeparam T Object type.
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
  let options: Partial<FromSnapshotOptions> | undefined

  if (isLateTypeChecker(arg1) || arg1 instanceof TypeChecker) {
    const typeChecker = resolveTypeChecker(arg1)
    snapshot = typeChecker.fromSnapshotProcessor ? typeChecker.fromSnapshotProcessor(arg2) : arg2
    options = arg3
  } else {
    snapshot = arg1
    options = arg2
  }

  return fromSnapshotAction(snapshot, options)
}

const fromSnapshotAction = action(
  "fromSnapshot",
  <T>(
    snapshot: _SnapshotInOf<T> | _SnapshotOutOf<T>,
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
)

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
