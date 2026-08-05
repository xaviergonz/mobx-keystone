import * as mobx from "mobx"
import {
  type IComputedValue,
  type IObservableArray,
  isObservableArray,
  isObservableMap,
  isObservableObject,
  isObservableSet,
  type ObservableMap,
  type ObservableSet,
} from "mobx"
import type { JSONPrimitiveValue, PrimitiveValue } from "./types"

/**
 * A mobx-keystone error.
 */
export class MobxKeystoneError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, new.target.prototype)
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
  if (!isObject(value)) {
    return false
  }
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
export let hasOwnProp: (object: object, propName: PropertyKey) => boolean = (
  object,
  propName
): boolean => {
  const impl: (object: object, propName: PropertyKey) => boolean =
    typeof Object.hasOwn === "function"
      ? Object.hasOwn
      : (object, propName) => {
          // biome-ignore lint/suspicious/noPrototypeBuiltins: legacy fallback for runtimes without Object.hasOwn.
          return Object.prototype.hasOwnProperty.call(object, propName)
        }

  hasOwnProp = impl
  return impl(object, propName)
}

/**
 * @internal
 */
export function setProtoProp(target: object, value: unknown): void {
  Object.defineProperty(target, "__proto__", {
    enumerable: true,
    writable: true,
    configurable: true,
    value,
  })
}

/**
 * @internal
 */
export function copyOwnEnumerableProps<TTarget extends Record<string, any>>(
  target: TTarget,
  source: Record<string, any>,
  mapValue?: (value: unknown, key: string) => unknown
): TTarget {
  const keys = Object.keys(source)
  const len = keys.length
  for (let i = 0; i < len; i++) {
    const key = keys[i]
    const value = source[key]
    const mappedValue = mapValue ? mapValue(value, key) : value
    if (key === "__proto__") {
      setProtoProp(target, mappedValue)
    } else {
      ;(target as Record<PropertyKey, unknown>)[key] = mappedValue
    }
  }

  return target
}

/**
 * @internal
 */
export function clonePlainObject<T extends Record<string, any>>(source: T): T {
  return copyOwnEnumerableProps({} as T, source)
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
    default:
      return value === null
  }
}

/**
 * @internal
 */
export function isJSONPrimitive(value: unknown): value is JSONPrimitiveValue {
  switch (typeof value) {
    case "number":
      return Number.isFinite(value)
    case "string":
    case "boolean":
      return true
    default:
      return value === null
  }
}

/**
 * @internal
 */
export function deleteFromArray<T>(array: T[], value: T): boolean {
  const index = array.indexOf(value)
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

declare const process:
  | {
      env?: Record<string, string | undefined>
    }
  | undefined

/**
 * @internal
 */
export const inDevMode =
  process?.env?.NODE_ENV !== undefined && process.env.NODE_ENV !== "production"

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
export function assertIsMap(
  value: unknown,
  argName: string
): asserts value is Map<any, any> | ObservableMap {
  if (!isMap(value)) {
    throw failure(`${argName} must be a map`)
  }
}

/**
 * @internal
 */
export function assertIsSet(
  value: unknown,
  argName: string
): asserts value is Set<any> | ObservableSet {
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
export const runAfterNewSymbol = Symbol("runAfterNew")

/**
 * @internal
 */
export const runBeforeOnInitSymbol = Symbol("runBeforeOnInit")

type LateInitializationFunctionsArray = ((instance: any) => void)[]

/**
 * @internal
 */
export function addLateInitializationFunction(
  target: any,
  symbol: symbol,
  fn: (instance: any) => void
) {
  let array: LateInitializationFunctionsArray | undefined = target[symbol]
  // biome-ignore lint/suspicious/noPrototypeBuiltins: support old browsers
  if (!(array && Object.prototype.hasOwnProperty.call(target, symbol))) {
    // leave base array unmodified, create new array in the derived class
    array = array ? array.slice() : []
    addHiddenProp(target, symbol, array)
  }
  array.push(fn)
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
      // biome-ignore lint/suspicious/noConsole: this internal helper intentionally emits user-facing warnings.
      console.warn(msg)
      break
    case "error":
      // biome-ignore lint/suspicious/noConsole: this internal helper intentionally emits user-facing errors.
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
  makeObservable: (mobx as any)[
    // just to ensure import * is kept properly
    String.fromCharCode("l".charCodeAt(0) + 1) + "akeObservable"
  ],
}

/**
 * MobX method action decorator compatible with both legacy decorators and
 * MobX 7's standard decorator API.
 *
 * This is a decorator compatibility helper, not a replacement for other
 * `action` overloads such as `action(fn)`. Field decorators are not supported.
 *
 * @hidden
 */
export function mobxAction<This, Args extends unknown[], Return>(
  value: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
): (this: This, ...args: Args) => Return
export function mobxAction<This, Args extends unknown[], Return>(
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<(this: This, ...args: Args) => Return>
): TypedPropertyDescriptor<(this: This, ...args: Args) => Return> | void
export function mobxAction(...args: any[]): any {
  if (isStandardDecoratorContext(args[1])) {
    return (mobx.action as any)(args[0], args[1])
  }

  if (getMobxVersion() < 7) {
    return (mobx.action as any)(...args)
  }

  const descriptor = args[2] as PropertyDescriptor | undefined
  if (!descriptor?.value) {
    return descriptor
  }

  if (mobx.isAction(descriptor.value)) {
    return descriptor
  }

  return {
    ...descriptor,
    value: mobx.action(String(args[1]), descriptor.value),
  }
}

/**
 * MobX getter computed decorator compatible with both legacy decorators and
 * MobX 7's standard decorator API.
 *
 * This is a decorator compatibility helper, not a replacement for other
 * `computed` overloads. Field decorators and decorator options are not supported.
 * Under MobX 7's legacy decorator transform the getter is backed by a computed
 * value, but is not registered as a computed property for MobX introspection.
 *
 * @hidden
 */
export function mobxComputed<This, Value>(
  value: (this: This) => Value,
  context: ClassGetterDecoratorContext<This, Value>
): ((this: This) => Value) | void
export function mobxComputed<Value>(
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<Value>
): TypedPropertyDescriptor<Value> | void
export function mobxComputed(...args: any[]): any {
  if (isStandardDecoratorContext(args[1])) {
    return (mobx.computed as any)(args[0], args[1])
  }

  if (getMobxVersion() < 7) {
    return (mobx.computed as any)(...args)
  }

  const descriptor = args[2] as PropertyDescriptor | undefined
  if (!descriptor?.get) {
    return descriptor
  }

  const getter = descriptor.get
  const computedValues = new WeakMap<object, IComputedValue<unknown>>()

  return {
    ...descriptor,
    get(this: object) {
      let computedValue = computedValues.get(this)
      if (!computedValue) {
        const newComputedValue = mobx.computed(() => getter.call(this), {
          name: String(args[1]),
        })
        computedValues.set(this, newComputedValue)
        computedValue = newComputedValue
      }
      return computedValue.get()
    },
  }
}

// Mirrors MobX's standard-decorator call detection. Legacy decorator calls use
// a string or symbol property key as their second argument, so checking `kind`
// distinguishes the call shapes without claiming to validate the full context.
function isStandardDecoratorContext(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { kind?: unknown }).kind === "string"
  )
}

/**
 * Calls `makeObservable` across MobX versions. MobX 7 requires an annotations
 * object, while MobX 6 and older versions use decorator metadata when no
 * annotations are passed.
 *
 * @internal
 */
export function makeObservableCompat(target: object, annotations?: object): void {
  if (getMobxVersion() >= 7) {
    mobx6.makeObservable(target, annotations ?? {})
  } else {
    mobx6.makeObservable(target)
  }
}

/**
 * @internal
 */
export function propNameToSetterName(propName: string): string {
  return `set${propName[0].toUpperCase()}${propName.slice(1)}`
}

let cachedMobxVersion: number | undefined

/**
 * @internal
 */
export function getMobxVersion(): number {
  if (cachedMobxVersion !== undefined) {
    return cachedMobxVersion
  }

  if (mobx6.makeObservable!) {
    const version = (mobx as any)._getGlobalState?.().version
    cachedMobxVersion = typeof version === "number" && version >= 7 ? version : 6
  } else if ("extendShallowObservable" in mobx) {
    cachedMobxVersion = 4
  } else {
    cachedMobxVersion = 5
  }

  return cachedMobxVersion
}

/**
 * @internal
 */
export const namespace = "mobx-keystone"
