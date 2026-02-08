import type { WrapInActionOverrideContextFn } from "../action/wrapInAction"
import { setDataModelAction } from "../dataModel/actions"
import { BaseDataModel } from "../dataModel/BaseDataModel"
import { isDataModel, isDataModelClass } from "../dataModel/utils"
import { BaseModel } from "../model/BaseModel"
import { modelInfoByClass } from "../modelShared/modelInfo"
import { runAfterModelDecoratorSymbol } from "../modelShared/modelSymbols"
import { addLateInitializationFunction, failure, inDevMode, runAfterNewSymbol } from "./index"

type WrapFunction = (
  data: {
    actionName: string | (() => string)
    overrideContext: WrapInActionOverrideContextFn | undefined
  },
  fn: any
) => any

const unboundMethodSymbol = Symbol("unboundMethod")

const functionPropertiesToSkip = new Set<PropertyKey>([
  "arguments",
  "caller",
  "length",
  "name",
  "prototype",
  unboundMethodSymbol,
])

type ReflectWithMetadata = typeof Reflect & {
  getOwnMetadataKeys?: (target: object) => any[]
  getOwnMetadata?: (metadataKey: any, target: object) => any
  defineMetadata?: (metadataKey: any, metadataValue: any, target: object) => void
}

/**
 * @internal
 */
export function copyFunctionMetadata(source: unknown, target: unknown): void {
  if (typeof source !== "function" || typeof target !== "function" || source === target) {
    return
  }

  const keys = Reflect.ownKeys(source)
  for (let i = 0, len = keys.length; i < len; i++) {
    const key = keys[i]
    if (functionPropertiesToSkip.has(key)) {
      continue
    }

    const descriptor = Object.getOwnPropertyDescriptor(source, key)
    if (!descriptor) {
      continue
    }

    try {
      Object.defineProperty(target, key, descriptor)
    } catch {
      // ignore non-copyable properties
    }
  }

  const reflect = Reflect as ReflectWithMetadata
  if (
    typeof reflect.getOwnMetadataKeys === "function" &&
    typeof reflect.getOwnMetadata === "function" &&
    typeof reflect.defineMetadata === "function"
  ) {
    try {
      const metadataKeys = reflect.getOwnMetadataKeys(source)
      for (let i = 0, len = metadataKeys.length; i < len; i++) {
        try {
          reflect.defineMetadata!(
            metadataKeys[i],
            reflect.getOwnMetadata!(metadataKeys[i], source),
            target
          )
        } catch {
          // ignore non-copyable metadata entries
        }
      }
    } catch {
      // ignore metadata providers that throw during key discovery
    }
  }
}

const bindMethod = (method: any, instance: any) => {
  const unboundMethod = unboundMethodSymbol in method ? method[unboundMethodSymbol] : method

  const boundMethod = unboundMethod.bind(instance)
  copyFunctionMetadata(unboundMethod, boundMethod)
  boundMethod[unboundMethodSymbol] = unboundMethod

  return boundMethod
}

/**
 * @internal
 */
export function decorateWrapMethodOrField(
  decoratorName: string,
  args: any[],
  wrap: WrapFunction
): any {
  if (typeof args[1] !== "object") {
    // non-standard decorators

    const target = args[0]
    const propertyKey: string = args[1]
    const baseDescriptor: PropertyDescriptor | undefined = args[2]

    checkModelDecoratorTaget(decoratorName, target)
    checkDecoratorContext("transaction", propertyKey, false)

    const data = getActionNameAndContextOverride(target, propertyKey, true)

    const addFieldDecorator = () => {
      addLateInitializationFunction(target, runAfterNewSymbol, (instance) => {
        const method = wrap(data, instance[propertyKey])

        // all of this is to make method destructuring work
        instance[propertyKey] = bindMethod(method, instance)
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
  } else {
    // standard decorators
    const ctx = args[1] as ClassMethodDecoratorContext | ClassFieldDecoratorContext

    checkDecoratorContext(decoratorName, ctx.name, ctx.static)
    switch (ctx.kind) {
      case "method": {
        // @action method() { }
        const value = args[0]
        const propertyKey = ctx.name as string

        let inited = false

        ctx.addInitializer(function (this: any) {
          // only do one override on first initialization for the whole class
          if (inited) {
            return
          }
          inited = true

          const target = this
          checkModelDecoratorTaget(decoratorName, target)

          // find the deepest proto that matches the value
          let proto = this
          let nextProto = Object.getPrototypeOf(proto)
          while (nextProto && nextProto[propertyKey] === value) {
            proto = nextProto
            nextProto = Object.getPrototypeOf(proto)
          }

          proto[propertyKey] = wrap(
            getActionNameAndContextOverride(target, propertyKey, false),
            proto[propertyKey]
          )
        })

        break
      }

      case "field": {
        // @action method = () => {}
        const propertyKey = ctx.name as string

        let data: ReturnType<typeof getActionNameAndContextOverride> | undefined

        return function (this: any, value: any) {
          const instance = this

          if (!data) {
            checkModelDecoratorTaget(decoratorName, instance)
            data = getActionNameAndContextOverride(instance, propertyKey, false)
          }

          const method = wrap(data, value)

          // all of this is to make method destructuring work
          return bindMethod(method, instance)
        }
      }

      default:
        throw failure(`@${decoratorName} can only be used on fields or methods}`)
    }
  }
}

/**
 * @internal
 */
export function checkDecoratorContext(
  decoratorName: string,
  propertyKey: string | symbol,
  isStatic: boolean
) {
  if (!inDevMode) {
    return
  }

  if (typeof propertyKey !== "string") {
    throw failure(`@${decoratorName} cannot decorate symbol properties`)
  }
  if (isStatic) {
    throw failure(`@${decoratorName} cannot be used with static fields or methods`)
  }
}

const dataModelOverrideContext: WrapInActionOverrideContextFn = (ctx, self) => {
  ctx.target = self.$
}

function getActionNameAndContextOverride(
  target: any,
  propertyKey: string,
  runLate: boolean
): {
  actionName: string | (() => string)
  overrideContext: WrapInActionOverrideContextFn | undefined
} {
  if (isDataModelClass(target) || isDataModel(target)) {
    const modelClass: any = isDataModelClass(target) ? target : target.constructor

    let fullActionName: string

    const lateInit = (finalClass: any) => {
      const modelInfo = modelInfoByClass.get(finalClass)!
      fullActionName = `fn::${modelInfo.name}::${propertyKey}`
      setDataModelAction(fullActionName, modelInfo.class, propertyKey)
    }

    if (runLate) {
      addLateInitializationFunction(modelClass, runAfterModelDecoratorSymbol, lateInit)
    } else {
      lateInit(modelClass)
    }

    return {
      actionName: () => fullActionName,
      overrideContext: dataModelOverrideContext,
    }
  } else {
    return { actionName: propertyKey, overrideContext: undefined }
  }
}

function checkModelDecoratorTaget(decoratorName: string, target: any) {
  if (!inDevMode) {
    return
  }

  const errMessage = `@${decoratorName} must be used over model classes or instances`

  if (!target) {
    throw failure(errMessage)
  }

  // check target is a model object or extended class
  const isModel =
    target instanceof BaseModel || target === BaseModel || target.prototype instanceof BaseModel
  if (isModel) {
    return
  }

  const isDataModel =
    target instanceof BaseDataModel ||
    target === BaseDataModel ||
    target.prototype instanceof BaseDataModel
  if (isDataModel) {
    return
  }

  throw failure(errMessage)
}
