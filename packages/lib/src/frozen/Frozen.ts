import { isObservable, toJS } from "mobx"
import { getGlobalConfig } from "../globalConfig"
import type { FrozenData } from "../snapshot"
import { tweak } from "../tweaker/tweak"
import { failure, inDevMode, isPlainObject, isPrimitive } from "../utils"

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
 * @template T Data type.
 */
export class Frozen<T> {
  /**
   * Frozen data, deeply immutable.
   */
  readonly data: T

  /**
   * Creates an instance of Frozen.
   * Do not use directly, use `frozen` instead.
   *
   * @param dataToFreeze
   * @param checkMode
   */
  constructor(dataToFreeze: T, checkMode: FrozenCheckMode = FrozenCheckMode.DevModeOnly) {
    if (isObservable(dataToFreeze)) {
      dataToFreeze = toJS(dataToFreeze)
    }

    const check =
      checkMode === FrozenCheckMode.On || (inDevMode && checkMode === FrozenCheckMode.DevModeOnly)
    if (check) {
      checkDataIsSerializableAndFreeze(dataToFreeze)
    }

    this.data = dataToFreeze

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

/**
 * Converts some data into a frozen snapshot.
 *
 * @param data Data to convert.
 * @returns The frozen snapshot.
 */
export function toFrozenSnapshot<T>(data: T): FrozenData<T> {
  return {
    [frozenKey]: true,
    data,
  }
}

function checkDataIsSerializableAndFreeze(data: unknown) {
  const ancestors = new Set<object>()
  const stack: {
    data: object
    keys: string[] | undefined
    length: number
    nextIndex: number
  }[] = []

  const visit = (value: unknown) => {
    if (isPrimitive(value)) return

    if (!Array.isArray(value) && !isPlainObject(value)) {
      throw failure(`frozen data must be plainly serializable to JSON, but ${value} is not`)
    }
    if (ancestors.has(value)) {
      throw failure("frozen data must not contain cycles")
    }
    ancestors.add(value)
    const keys = Array.isArray(value) ? undefined : Object.keys(value)
    stack.push({
      data: value,
      keys,
      length: keys ? keys.length : (value as unknown[]).length,
      nextIndex: 0,
    })
  }

  visit(data)
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (frame.nextIndex === frame.length) {
      Object.freeze(frame.data)
      ancestors.delete(frame.data)
      stack.pop()
      continue
    }

    const index = frame.nextIndex++
    const value = frame.keys
      ? (frame.data as Record<string, unknown>)[frame.keys[index]]
      : (frame.data as unknown[])[index]
    if (!frame.keys && value === undefined && !getGlobalConfig().allowUndefinedArrayElements) {
      throw failure(
        "undefined is not supported inside arrays since it is not serializable in JSON, consider using null instead"
      )
    }
    visit(value)
  }
}

/**
 * Checks if an snapshot is an snapshot for a frozen data.
 *
 * @param snapshot
 * @returns
 */
export function isFrozenSnapshot<T = unknown>(snapshot: unknown): snapshot is FrozenData<T> {
  return isPlainObject(snapshot) && frozenKey in snapshot
}
