import * as mobx from "mobx"
import {
  IObservableArray,
  isObservableArray,
  isObservableMap,
  isObservableObject,
  isObservableSet,
  ObservableMap,
  ObservableSet,
} from "mobx"
import { NonEmptyArray, PrimitiveValue } from "./types"

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
 * Checks whether an array is non-empty.
 *
 * @param arr Array to check.
 * @returns `true` if `arr` is non-empty, otherwise `false`.
 */
export function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length !== 0
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
export function assertIsPlainObject(value: unknown, argName: string): asserts value is object {
  if (!isPlainObject(value)) {
    throw failure(`${argName} must be a plain object`)
  }
}

/**
 * @ignore
 * @internal
 */
export function assertIsObservableObject(value: unknown, argName: string): asserts value is object {
  if (!isObservableObject(value)) {
    throw failure(`${argName} must be an observable object`)
  }
}

/**
 * @ignore
 * @internal
 */
export function assertIsObservableArray(
  value: unknown,
  argName: string
): asserts value is IObservableArray {
  if (!isObservableArray(value)) {
    throw failure(`${argName} must be an observable array`)
  }
}

/**
 * @ignore
 * @internal
 */
export function assertIsMap(value: unknown, argName: string): asserts value is Map<any, any> {
  if (!isMap(value)) {
    throw failure(`${argName} must be a map`)
  }
}

/**
 * @ignore
 * @internal
 */
export function assertIsSet(value: unknown, argName: string): asserts value is Set<any> {
  if (!isSet(value)) {
    throw failure(`${argName} must be a set`)
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
export function assertIsString(value: unknown, argName: string): asserts value is string {
  if (typeof value !== "string") {
    throw failure(`${argName} must be a string`)
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

const decoratorsSymbol = Symbol("decorators")

type WrapFunction = (data: DecorateMethodOrFieldData, fn: any) => any
type LateInitializationFunctionsArray = ((instance: any) => void)[]

/**
 * @ignore
 * @internal
 */
export function addLateInitializationFunction(target: any, fn: (instance: any) => void) {
  let decoratorsArray: LateInitializationFunctionsArray = target[decoratorsSymbol]
  if (!decoratorsArray) {
    decoratorsArray = []
    addHiddenProp(target, decoratorsSymbol, decoratorsArray)
  }
  decoratorsArray.push(fn)
}

/**
 * @ignore
 * @internal
 */
export function decorateWrapMethodOrField(
  decoratorName: string,
  data: DecorateMethodOrFieldData,
  wrap: WrapFunction
): any {
  const { target, propertyKey, baseDescriptor } = data

  const addFieldDecorator = () => {
    addLateInitializationFunction(target, (instance) => {
      instance[propertyKey] = wrap(data, instance[propertyKey])
    })
  }

  if (baseDescriptor) {
    if (baseDescriptor.get !== undefined) {
      throw failure(`@${decoratorName} cannot be used with getters`)
    }

    if (baseDescriptor.value) {
      // babel / typescript - method decorator
      // @action method() { }
      return {
        enumerable: false,
        writable: true,
        configurable: true,
        value: wrap(data, baseDescriptor.value),
      }
    } else {
      // babel - field decorator: @action method = () => {}
      addFieldDecorator()
    }
  } else {
    // typescript - field decorator
    addFieldDecorator()
  }
}

/**
 * @ignore
 * @internal
 */
export function runLateInitializationFunctions(instance: any): void {
  const fns: LateInitializationFunctionsArray | undefined = instance[decoratorsSymbol]
  if (fns) {
    for (const fn of fns) {
      fn(instance)
    }
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

/**
 * @ignore
 * @internal
 */
export function lazy<V>(valueGen: () => V): () => V {
  let inited = false
  let val: V | undefined

  return (): V => {
    if (!inited) {
      val = valueGen()
      inited = true
    }
    return val!
  }
}

// just to ensure import * is kept properly
/**
 * @ignore
 * @internal
 */
export const mobx6 = {
  // eslint-disable-next-line no-useless-concat
  makeObservable: (mobx as any)["makeObservable" + ""] as typeof mobx["makeObservable"],
}

/**
 * @ignore
 * @internal
 */
export function getMobxVersion(): number {
  if (mobx6.makeObservable!) {
    return 6
  } else {
    return 5
  }
}
