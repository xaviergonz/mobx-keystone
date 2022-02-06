import { computed, IComputedValue } from "mobx"
import { readonlyMiddleware } from "../actionMiddlewares/readonlyMiddleware"
import { createContext } from "../context/context"
import { isDataModelClass } from "../dataModel/utils"
import { isModelClass } from "../model/utils"
import { isTreeNode } from "../tweaker/core"
import { tryUntweak, tweak } from "../tweaker/tweak"
import { addLateInitializationFunction, failure, runBeforeOnInitSymbol } from "../utils"

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

function getComputedTreeNodeInfo(instance: object) {
  let map = computedTreeNodeInfo.get(instance)
  if (!map) {
    map = new Map()
    computedTreeNodeInfo.set(instance, map)
  }

  return map
}

/**
 * Decorator for turning a computed property into a computed tree which supports tree traversal
 * functions, contexts, references, etc.
 *
 * @param target Prototype of the class.
 * @param propertyKey Name of the member.
 * @param descriptor Property descriptor for the member.
 */
export function computedTree(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  if (!descriptor.get) {
    throw failure("@computedTree requires a 'get' accessor")
  }

  const targetClass = target.constructor
  if (!isModelClass(targetClass) && !isDataModelClass(targetClass)) {
    throw failure("@computedTree can only decorate 'get' accessors of class or data models")
  }

  const original = descriptor.get

  descriptor.get = function () {
    const entry = getComputedTreeNodeInfo(this).get(propertyKey)!

    const oldValue = entry.value
    const newValue = entry.computed.get()

    if (oldValue === newValue) {
      return entry.tweakedValue
    }

    tweak(oldValue, undefined)
    tryUntweak(oldValue)

    const tweakedValue = tweakComputedTreeNode(newValue, this, propertyKey)
    entry.value = newValue
    entry.tweakedValue = tweakedValue
    return tweakedValue
  }

  addLateInitializationFunction(target, runBeforeOnInitSymbol, (instance) => {
    const c = computed(() => original.call(instance), { keepAlive: true })
    const newValue = c.get()
    const tweakedValue = tweakComputedTreeNode(newValue, instance, propertyKey)

    getComputedTreeNodeInfo(instance).set(propertyKey, {
      computed: c,
      value: newValue,
      tweakedValue,
    })
  })
}
