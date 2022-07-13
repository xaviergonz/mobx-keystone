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
import { JSONPrimitiveValue, PrimitiveValue } from "./types"

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
 * @internal
 */
export function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (!isObject(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * @internal
 */
export function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object"
}

/**
 * @internal
 */
export function isPrimitive(value: unknown): value is PrimitiveValue {
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
 * @internal
 */
export function isJSONPrimitive(value: unknown): value is JSONPrimitiveValue {
  switch (typeof value) {
    case "number":
      return isFinite(value)
    case "string":
    case "boolean":
      return true
  }
  return value === null
}

/**
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
 * @internal
 */
export function isMap(val: unknown): val is Map<any, any> | ObservableMap {
  return val instanceof Map || isObservableMap(val)
}

/**
 * @internal
 */
export function isSet(val: unknown): val is Set<any> | ObservableSet {
  return val instanceof Set || isObservableSet(val)
}

/**
 * @internal
 */
export function isArray(val: unknown): val is any[] | IObservableArray {
  return Array.isArray(val) || isObservableArray(val)
}

/**
 * @internal
 */
export function inDevMode(): boolean {
  return process.env.NODE_ENV !== "production"
}

/**
 * @internal
 */
export function assertIsObject(value: unknown, argName: string): asserts value is object {
  if (!isObject(value)) {
    throw failure(`${argName} must be an object`)
  }
}

/**
 * @internal
 */
export function assertIsPlainObject(value: unknown, argName: string): asserts value is object {
  if (!isPlainObject(value)) {
    throw failure(`${argName} must be a plain object`)
  }
}

/**
 * @internal
 */
export function assertIsObservableObject(value: unknown, argName: string): asserts value is object {
  if (!isObservableObject(value)) {
    throw failure(`${argName} must be an observable object`)
  }
}

/**
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
 * @internal
 */
export function assertIsMap(value: unknown, argName: string): asserts value is Map<any, any> {
  if (!isMap(value)) {
    throw failure(`${argName} must be a map`)
  }
}

/**
 * @internal
 */
export function assertIsSet(value: unknown, argName: string): asserts value is Set<any> {
  if (!isSet(value)) {
    throw failure(`${argName} must be a set`)
  }
}

/**
 * @internal
 */
export function assertIsFunction(value: unknown, argName: string): asserts value is Function {
  if (typeof value !== "function") {
    throw failure(`${argName} must be a function`)
  }
}

/**
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
 * @internal
 */
export function assertIsString(value: unknown, argName: string): asserts value is string {
  if (typeof value !== "string") {
    throw failure(`${argName} must be a string`)
  }
}

/**
 * @internal
 */
export interface DecorateMethodOrFieldData {
  target: any
  propertyKey: string
  baseDescriptor?: PropertyDescriptor & { initializer?: () => any }
}

/**
 * @internal
 */
export const runAfterNewSymbol = Symbol("runAfterNew")

/**
 * @internal
 */
export const runBeforeOnInitSymbol = Symbol("runBeforeOnInit")

type WrapFunction = (data: DecorateMethodOrFieldData, fn: any) => any
type LateInitializationFunctionsArray = ((instance: any) => void)[]

/**
 * @internal
 */
export function addLateInitializationFunction(
  target: any,
  symbol: symbol,
  fn: (instance: any) => void
) {
  let array: LateInitializationFunctionsArray = target[symbol]
  if (!array || !Object.prototype.hasOwnProperty.call(target, symbol)) {
    // leave base array unmodified, create new array in the derived class
    array = array ? array.slice() : []
    addHiddenProp(target, symbol, array)
  }
  array.push(fn)
}

const unboundMethodSymbol = Symbol("unboundMethod")

/**
 * @internal
 */
export function decorateWrapMethodOrField(
  decoratorName: string,
  data: DecorateMethodOrFieldData,
  wrap: WrapFunction
): any {
  const { target, propertyKey, baseDescriptor } = data

  const addFieldDecorator = () => {
    addLateInitializationFunction(target, runAfterNewSymbol, (instance) => {
      // all of this is to make method destructuring work
      const method = wrap(data, instance[propertyKey])

      const unboundMethod = unboundMethodSymbol in method ? method[unboundMethodSymbol] : method

      const boundMethod = unboundMethod.bind(instance)
      // copy modelAction symbol, etc.
      Object.getOwnPropertySymbols(unboundMethod).forEach((s) => {
        boundMethod[s] = unboundMethod[s]
      })
      boundMethod[unboundMethodSymbol] = unboundMethod

      instance[propertyKey] = boundMethod
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
    // typescript - field decorator: @action method = () => {}
    addFieldDecorator()
  }
}

/**
 * @internal
 */
export function runLateInitializationFunctions(target: any, symbol: symbol): void {
  const fns: LateInitializationFunctionsArray | undefined = target[symbol]
  if (fns) {
    for (const fn of fns) {
      fn(target)
    }
  }
}

const warningsAlreadyDisplayed = new Set<string>()

/**
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

/**
 * @internal
 */
export function lazy<A extends unknown[], R>(getter: (...args: A) => R): typeof getter {
  let memoizedValue: R
  let memoized = false

  return (...args: A): R => {
    if (!memoized) {
      memoizedValue = getter(...args)
      memoized = true
    }
    return memoizedValue
  }
}

/**
 * @internal
 */
export const identityFn = <T>(x: T): T => x

/**
 * @internal
 */
export const mobx6 = {
  // eslint-disable-next-line no-useless-concat
  makeObservable: (mobx as any)[
    // just to ensure import * is kept properly
    String.fromCharCode("l".charCodeAt(0) + 1) + "akeObservable"
  ],
}

/**
 * @internal
 */
export function propNameToSetterName(propName: string): string {
  return `set${propName[0].toUpperCase()}${propName.slice(1)}`
}

/**
 * @internal
 */
export function getMobxVersion(): number {
  if (mobx6.makeObservable!) {
    return 6
  } else {
    return 5
  }
}

/**
 * @internal
 */
export const namespace = "mobx-keystone"
