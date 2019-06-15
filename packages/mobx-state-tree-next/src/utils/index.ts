import {
  IObservableArray,
  isObservableArray,
  isObservableMap,
  isObservableSet,
  ObservableMap,
  ObservableSet,
} from "mobx"
import { modelMetadataKey } from "../model/metadata"
import { Model } from "../model/Model"
import { SnapshotInOfModel } from "../snapshot"

export function mapGetOrDefault<K extends object, V>(
  map: WeakMap<K, V> | Map<K, V>,
  key: K,
  def: () => V
) {
  if (map.has(key)) {
    return map.get(key)!
  }
  const newValue = def()!
  map.set(key, newValue)
  return newValue
}

export class MobxStateTreeNextError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, MobxStateTreeNextError.prototype)
  }
}

export function failure(msg: string) {
  return new MobxStateTreeNextError(msg)
}

export function addHiddenProp(object: any, propName: PropertyKey, value: any) {
  Object.defineProperty(object, propName, {
    enumerable: false,
    writable: true,
    configurable: true,
    value,
  })
}

export function isPlainObject(value: any): value is Object {
  if (!isObject(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function isObject(value: any): value is Object {
  return value !== null && typeof value === "object"
}

export function isPrimitive(value: any): value is number | string | boolean | undefined | null {
  switch (typeof value) {
    case "object":
      return value === null
    case "function":
    case "symbol":
      return false
    default:
      return true
  }
}

export function debugFreeze(value: object) {
  if (inDevMode()) {
    Object.freeze(value)
  }
}

export function deleteFromArray<T>(array: T[], value: T): boolean {
  let index = array.indexOf(value)
  if (index >= 0) {
    array.splice(index, 1)
    return true
  }
  return false
}

export function isModelSnapshot(sn: any): sn is SnapshotInOfModel<Model> {
  return isPlainObject(sn) && !!sn[modelMetadataKey]
}

export function isMap(val: any): val is Map<any, any> | ObservableMap {
  return val instanceof Map || isObservableMap(val)
}

export function isSet(val: any): val is Set<any> | ObservableSet {
  return val instanceof Set || isObservableSet(val)
}

export function isArray(val: any): val is any[] | IObservableArray {
  return Array.isArray(val) || isObservableArray(val)
}

export function inDevMode(): boolean {
  return process.env.NODE_ENV !== "production"
}
