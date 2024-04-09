import { computed, IComputedValue } from "mobx"
import { readonlyMiddleware } from "../actionMiddlewares/readonlyMiddleware"
import { createContext } from "../context/context"
import { isDataModelClass } from "../dataModel/utils"
import { isModelClass } from "../model/utils"
import { isTreeNode } from "../tweaker/core"
import { tweak } from "../tweaker/tweak"
import { addLateInitializationFunction, failure, runBeforeOnInitSymbol } from "../utils"
import { getOrCreate } from "../utils/mapUtils"
import { checkDecoratorContext } from "../utils/decorators"

const computedTreeContext = createContext(false)

/**
 * Returns if a given node is a computed tree node.
 *
 * @param node Node to check.
 * @returns `true` if it is a computed tree node, `false` otherwise.
 */
export function isComputedTreeNode(node: object): boolean {
  return computedTreeContext.get(node)
}

const tweakedComputedTreeNodes = new WeakSet<object>()

function tweakComputedTreeNode<T>(newValue: T, parent: unknown, path: string): T {
  const tweakedValue = tweak(newValue, { parent, path })
  if (isTreeNode(tweakedValue) && !tweakedComputedTreeNodes.has(tweakedValue)) {
    tweakedComputedTreeNodes.add(tweakedValue)
    readonlyMiddleware(tweakedValue)
    computedTreeContext.set(tweakedValue, true)
  }
  return tweakedValue
}

const computedTreeNodeInfo = new WeakMap<
  object,
  Map<string, { computed: IComputedValue<unknown>; value: unknown; tweakedValue: unknown }>
>()

function getOrCreateComputedTreeNodeInfo(instance: object) {
  return getOrCreate(computedTreeNodeInfo, instance, () => new Map())
}

/**
 * Decorator for turning a computed property into a computed tree which supports tree traversal
 * functions, contexts, references, etc.
 */
export function computedTree(...args: any[]): any {
  const createGetter = (propertyKey: string) =>
    function (this: any) {
      const entry = getOrCreateComputedTreeNodeInfo(this).get(propertyKey)!

      const oldValue = entry.value
      const newValue = entry.computed.get()

      if (oldValue === newValue) {
        return entry.tweakedValue
      }

      const oldTweakedValue = entry.tweakedValue
      tweak(oldTweakedValue, undefined)

      const tweakedValue = tweakComputedTreeNode(newValue, this, propertyKey)
      entry.value = newValue
      entry.tweakedValue = tweakedValue
      return tweakedValue
    }

  const runLateInit = (instance: any, original: () => any, propertyKey: string) => {
    const c = computed(() => original.call(instance), { keepAlive: true })
    const newValue = c.get()
    const tweakedValue = tweakComputedTreeNode(newValue, instance, propertyKey)

    getOrCreateComputedTreeNodeInfo(instance).set(propertyKey, {
      computed: c,
      value: newValue,
      tweakedValue,
    })
  }

  const checkInstanceClass = (instance: any) => {
    const instanceClass = instance.constructor
    if (!isModelClass(instanceClass) && !isDataModelClass(instanceClass)) {
      throw failure("@computedTree can only decorate 'get' accessors of class or data models")
    }
  }

  if (typeof args[1] === "object") {
    // standard decorators
    const value = args[0]
    const ctx = args[1] as ClassGetterDecoratorContext

    if (ctx.kind !== "getter") {
      throw failure("@computedTree requires a 'get' accessor")
    }

    checkDecoratorContext("computedTree", ctx.name, ctx.static)

    const propertyKey = ctx.name as string
    const original = value

    let classChecked = false

    ctx.addInitializer(function (this: any) {
      const instance = this

      if (!classChecked) {
        checkInstanceClass(instance)
        classChecked = true
      }

      runLateInit(instance, original, propertyKey)
    })

    return createGetter(propertyKey)
  } else {
    // non-standard decorators
    const instance = args[0]
    const propertyKey: string = args[1]
    const descriptor = args[2]

    if (!descriptor.get) {
      throw failure("@computedTree requires a 'get' accessor")
    }

    checkDecoratorContext("computedTree", propertyKey, false)

    checkInstanceClass(instance)

    const original = descriptor.get

    descriptor.get = createGetter(propertyKey)

    addLateInitializationFunction(instance, runBeforeOnInitSymbol, (instance) => {
      runLateInit(instance, original, propertyKey)
    })
  }
}
