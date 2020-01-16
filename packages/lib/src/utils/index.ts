import {
  IObservableArray,
  isObservableArray,
  isObservableMap,
  isObservableSet,
  ObservableMap,
  ObservableSet,
} from "mobx"
import { PrimitiveValue } from "./types"

/**
 * A mobx-keystone error.
 */
export class MobxKeystoneError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, MobxKeystoneError.prototype)
  }
}

/**
 * @ignore
 * @internal
 */
export function failure(msg: string) {
  return new MobxKeystoneError(msg)
}

const writableHiddenPropDescriptor: PropertyDescriptor = {
  enumerable: false,
  writable: true,
  configurable: false,
  value: undefined,
}

/**
 * @ignore
 * @internal
 */
export function addHiddenProp(object: any, propName: PropertyKey, value: any, writable = true) {
  if (writable) {
    Object.defineProperty(object, propName, writableHiddenPropDescriptor)
    object[propName] = value
  } else {
    Object.defineProperty(object, propName, {
      enumerable: false,
      writable,
      configurable: true,
      value,
    })
  }
}

/**
 * @ignore
 * @internal
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
 * @internal
 */
export function isPlainObject(value: any): value is Object {
  if (!isObject(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * @ignore
 * @internal
 */
export function isObject(value: any): value is Object {
  return value !== null && typeof value === "object"
}

/**
 * @ignore
 * @internal
 */
export function isPrimitive(value: any): value is PrimitiveValue {
  switch (typeof value) {
    case "number":
    case "string":
    case "boolean":
    case "undefined":
    case "bigint":
      return true
  }
  return value === null
}

/**
 * @ignore
 * @internal
 */
export function debugFreeze(value: object) {
  if (inDevMode()) {
    Object.freeze(value)
  }
}

/**
 * @ignore
 * @internal
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
 * @internal
 */
export function isMap(val: any): val is Map<any, any> | ObservableMap {
  return val instanceof Map || isObservableMap(val)
}

/**
 * @ignore
 * @internal
 */
export function isSet(val: any): val is Set<any> | ObservableSet {
  return val instanceof Set || isObservableSet(val)
}

/**
 * @ignore
 * @internal
 */
export function isArray(val: any): val is any[] | IObservableArray {
  return Array.isArray(val) || isObservableArray(val)
}

/**
 * @ignore
 * @internal
 */
export function inDevMode(): boolean {
  return process.env.NODE_ENV !== "production"
}

/**
 * @ignore
 * @internal
 */
export function assertIsObject(value: unknown, argName: string): asserts value is object {
  if (!isObject(value)) {
    throw failure(`${argName} must be an object`)
  }
}

/**
 * @ignore
 * @internal
 */
export function assertIsFunction(value: unknown, argName: string): asserts value is Function {
  if (typeof value !== "function") {
    throw failure(`${argName} must be a function`)
  }
}

/**
 * @ignore
 * @internal
 */
export function assertIsPrimitive(
  value: unknown,
  argName: string
): asserts value is PrimitiveValue {
  if (!isPrimitive(value)) {
    throw failure(`${argName} must be a primitive`)
  }
}

/**
 * @ignore
 * @internal
 */
export interface DecorateMethodOrFieldData {
  target: any
  propertyKey: string
  baseDescriptor?: PropertyDescriptor & { initializer?: () => any }
}

/**
 * @ignore
 * @internal
 */
export function decorateWrapMethodOrField(
  decoratorName: string,
  data: DecorateMethodOrFieldData,
  wrap: (data: DecorateMethodOrFieldData, fn: any) => any
): any {
  const { target, propertyKey, baseDescriptor } = data

  if (baseDescriptor) {
    // method decorator
    if (baseDescriptor.get !== undefined) {
      throw failure(`@${decoratorName} cannot be used with getters`)
    }

    // babel / typescript
    // @action method() { }
    if (baseDescriptor.value) {
      // typescript
      return {
        enumerable: false,
        writable: true,
        configurable: true,
        value: wrap(data, baseDescriptor.value),
      }
    }

    // babel only: @action method = () => {}
    const { initializer } = baseDescriptor
    return {
      enumerable: false,
      configurable: true,
      writable: true,
      initializer() {
        // N.B: we can't immediately invoke initializer; this would be wrong
        return wrap(data, initializer!.call(this))
      },
    }
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

const warningsAlreadyDisplayed = new Set<string>()

/**
 * @ignore
 * @internal
 */
export function logWarning(type: "warn" | "error", msg: string, uniqueKey?: string): void {
  if (uniqueKey) {
    if (warningsAlreadyDisplayed.has(uniqueKey)) {
      return
    }
    warningsAlreadyDisplayed.add(uniqueKey)
  }

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

const notMemoized = Symbol("notMemoized")

/**
 * @ignore
 * @internal
 */
export function lateVal<TF extends (...args: any[]) => any>(getter: TF): TF {
  let memoized: TF | typeof notMemoized = notMemoized

  const fn = (...args: any[]): any => {
    if (memoized === notMemoized) {
      memoized = getter(...args)
    }
    return memoized
  }

  return fn as TF
}
