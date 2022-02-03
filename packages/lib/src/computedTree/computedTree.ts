import { computed } from "mobx"
import { readonlyMiddleware } from "../actionMiddlewares/readonlyMiddleware"
import { createContext } from "../context/context"
import { isDataModelClass } from "../dataModel/utils"
import { isModelClass } from "../model/utils"
import { isTreeNode } from "../tweaker/core"
import { tweak } from "../tweaker/tweak"
import { failure } from "../utils"

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
    const value = original.call(this)
    const tweakedValue = tweak(value, { parent: this, path: propertyKey })
    if (isTreeNode(tweakedValue)) {
      readonlyMiddleware(tweakedValue)
      computedTreeContext.set(tweakedValue, true)
    }
    return tweakedValue
  }

  // apply the `@computed` decorator to the accessor
  computed(target, propertyKey)
}
