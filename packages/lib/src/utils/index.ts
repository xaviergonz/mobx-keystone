import {
  IObservableArray,
  isObservableArray,
  isObservableMap,
  isObservableSet,
  ObservableMap,
  ObservableSet,
} from "mobx"

/**
 * @ignore
 */
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

/**
 * A mobx-keystone error.
 */
export class MobxDataModelError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, MobxDataModelError.prototype)
  }
}

/**
 * @ignore
 */
export function failure(msg: string) {
  return new MobxDataModelError(msg)
}

/**
 * @ignore
 */
export function addHiddenProp(object: any, propName: PropertyKey, value: any) {
  Object.defineProperty(object, propName, {
    enumerable: false,
    writable: true,
    configurable: true,
    value,
  })
}

/**
 * @ignore
 */
export function makePropReadonly<T>(object: T, propName: keyof T, enumerable: boolean) {
  const propDesc = Object.getOwnPropertyDescriptor(object, propName)
  if (propDesc) {
    propDesc.enumerable = enumerable
    if (propDesc.get) {
      delete propDesc.set
    } else {
      propDesc.writable = false
    }
    Object.defineProperty(object, propName, propDesc)
  }
}

/**
 * @ignore
 */
export function isPlainObject(value: any): value is Object {
  if (!isObject(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * @ignore
 */
export function isObject(value: any): value is Object {
  return value !== null && typeof value === "object"
}

/**
 * @ignore
 */
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

/**
 * @ignore
 */
export function debugFreeze(value: object) {
  if (inDevMode()) {
    Object.freeze(value)
  }
}

/**
 * @ignore
 */
export function deleteFromArray<T>(array: T[], value: T): boolean {
  let index = array.indexOf(value)
  if (index >= 0) {
    array.splice(index, 1)
    return true
  }
  return false
}

/**
 * @ignore
 */
export function isMap(val: any): val is Map<any, any> | ObservableMap {
  return val instanceof Map || isObservableMap(val)
}

/**
 * @ignore
 */
export function isSet(val: any): val is Set<any> | ObservableSet {
  return val instanceof Set || isObservableSet(val)
}

/**
 * @ignore
 */
export function isArray(val: any): val is any[] | IObservableArray {
  return Array.isArray(val) || isObservableArray(val)
}

/**
 * @ignore
 */
export function inDevMode(): boolean {
  return process.env.NODE_ENV !== "production"
}

/**
 * @ignore
 */
export function assertIsObject(value: any, argName: string): void {
  if (!isObject(value)) {
    throw failure(`${argName} must be an object`)
  }
}

/**
 * @ignore
 */
export function assertIsFunction(value: any, argName: string): void {
  if (typeof value !== "function") {
    throw failure(`${argName} must be a function`)
  }
}

/**
 * @ignore
 */
export function assertIsPrimitive(value: any, argName: string): void {
  if (!isPrimitive(value)) {
    throw failure(`${argName} must be a primitive`)
  }
}

/**
 * @ignore
 */
export interface DecorateMethodOrFieldData {
  target: any
  propertyKey: string
  baseDescriptor?: PropertyDescriptor
}

/**
 * @ignore
 */
export function decorateWrapMethodOrField(
  data: DecorateMethodOrFieldData,
  wrap: (data: DecorateMethodOrFieldData, fn: any) => any
) {
  const { target, propertyKey, baseDescriptor } = data

  if (baseDescriptor) {
    // method decorator
    return {
      enumerable: false,
      writable: true,
      configurable: true,
      value: wrap(data, baseDescriptor.value),
    } as any
  } else {
    // field decorator
    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: false,
      get() {
        return undefined
      },
      set(fn) {
        addHiddenProp(
          this,
          propertyKey,
          wrap(
            {
              ...data,
              target: this,
            },
            fn
          )
        )
      },
    })
  }
}

/**
 * @ignore
 */
export function logWarning(type: "warn" | "error", msg: string): void {
  msg = "[mobx-keystone] " + msg
  switch (type) {
    case "warn":
      console.warn(msg)
      break
    case "error":
      console.error(msg)
      break
    default:
      throw failure(`unknown log type - ${type}`)
  }
}
