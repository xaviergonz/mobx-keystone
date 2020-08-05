import { getGlobalConfig } from "../globalConfig"
import { SnapshotInOfFrozen } from "../snapshot"
import { tweak } from "../tweaker/tweak"
import { failure, inDevMode, isPlainObject, isPrimitive } from "../utils"
import { DeepReadonly } from "../utils/types"

/**
 * Should freeze and plain json checks be done when creating the frozen object?
 */
export enum FrozenCheckMode {
  /** Only when in dev mode */
  DevModeOnly = "devModeOnly",
  /** Always */
  On = "on",
  /** Never */
  Off = "off",
}

/**
 * @ignore
 */
export const frozenKey = "$frozen"

/**
 * A class that contains frozen data.
 * Use `frozen` to create an instance of this class.
 *
 * @typeparam T Data type.
 */
export class Frozen<T> {
  /**
   * Frozen data, deeply immutable.
   */
  readonly data: DeepReadonly<T>

  /**
   * Creates an instance of Frozen.
   * Do not use directly, use `frozen` instead.
   *
   * @param dataToFreeze
   * @param checkMode
   */
  constructor(dataToFreeze: T, checkMode: FrozenCheckMode = FrozenCheckMode.DevModeOnly) {
    const check =
      checkMode === FrozenCheckMode.On || (checkMode === FrozenCheckMode.DevModeOnly && inDevMode())
    if (check) {
      checkDataIsSerializableAndFreeze(dataToFreeze)
    }

    this.data = dataToFreeze as DeepReadonly<T>

    if (check) {
      Object.freeze(this.data)
    }

    tweak(this, undefined)
  }
}

/**
 * Marks some data as frozen. Frozen data becomes immutable (at least in dev mode), and is not enhanced
 * with capabilities such as getting the parent of the objects (except for the root object), it is not
 * made deeply observable (though the root object is observable by reference), etc.
 * On the other hand, this means it will be much faster to create/access. Use this for big data pieces
 * that are unlikely to change unless all of them change (for example lists of points for a polygon, etc).
 *
 * Note that data passed to frozen must be serializable to JSON, this is:
 * - primitive, plain object, or array
 * - without cycles
 *
 * @param data
 * @param checkMode
 */
export function frozen<T>(
  data: T,
  checkMode: FrozenCheckMode = FrozenCheckMode.DevModeOnly
): Frozen<T> {
  return new Frozen<T>(data, checkMode)
}

function checkDataIsSerializableAndFreeze(data: any) {
  // TODO: detect cycles and throw if present?

  // primitives are ok
  if (isPrimitive(data)) {
    return
  }

  if (Array.isArray(data)) {
    const arrLen = data.length
    for (let i = 0; i < arrLen; i++) {
      const v = data[i]
      if (v === undefined && !getGlobalConfig().allowUndefinedArrayElements) {
        throw failure(
          "undefined is not supported inside arrays since it is not serializable in JSON, consider using null instead"
        )
      }
      checkDataIsSerializableAndFreeze(v)
    }
    Object.freeze(data)
    return
  }

  if (isPlainObject(data)) {
    const dataKeys = Object.keys(data)
    const dataKeysLen = dataKeys.length
    for (let i = 0; i < dataKeysLen; i++) {
      const k = dataKeys[i]
      const v = data[k]

      checkDataIsSerializableAndFreeze(k)
      checkDataIsSerializableAndFreeze(v)
    }
    Object.freeze(data)
    return
  }

  throw failure(`frozen data must be plainly serializable to JSON, but ${data} is not`)
}

/**
 * @ignore
 * @internal
 *
 * Checks if an snapshot is an snapshot for a frozen data.
 *
 * @param snapshot
 * @returns
 */
export function isFrozenSnapshot(snapshot: any): snapshot is SnapshotInOfFrozen<Frozen<any>> {
  return isPlainObject(snapshot) && !!snapshot[frozenKey]
}
