import { action, computed, createAtom, IAtom, IComputedValue, observable } from "mobx"
import { fastGetParent } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"
import { getMobxVersion, mobx6 } from "../utils"
import { getOrCreate } from "../utils/mapUtils"

/**
 * A context.
 */
export interface Context<T> {
  /**
   * Gets the context default value.
   *
   * @returns
   */
  getDefault(): T

  /**
   * Sets the context default value.
   * @param value
   */
  setDefault(value: T): void

  /**
   * Sets the context default value resolver.
   * @param valueFn
   */
  setDefaultComputed(valueFn: () => T): void

  /**
   * Gets the context value for a given node.
   * @param node
   */
  get(node: object): T

  /**
   * Gets node that will provide the context value, or `undefined`
   * if it comes from the default.
   * @param node
   */
  getProviderNode(node: object): object | undefined

  /**
   * Sets the context value for a given node, effectively making it a provider.
   * @param node
   * @param value
   */
  set(node: object, value: T): void

  /**
   * Sets the context value resolver for a given node, effectively making it a provider.
   * @param node
   * @param valueFn
   */
  setComputed(node: object, valueFn: () => T): void

  /**
   * Unsets the context value for a given node, therefore it won't be a provider anymore.
   * @param node
   */
  unset(node: object): void
}

type ContextValue<T> =
  | {
      type: "value"
      value: T
    }
  | {
      type: "computed"
      value: IComputedValue<T>
    }

function getContextValue<T>(contextValue: ContextValue<T>): T {
  if (contextValue.type === "value") {
    return contextValue.value
  } else {
    return contextValue.value.get()
  }
}

class ContextClass<T> implements Context<T> {
  @observable.ref
  private defaultContextValue!: ContextValue<T>

  private readonly nodeContextValue = new WeakMap<object, ContextValue<T>>()
  private readonly nodeAtom = new WeakMap<object, IAtom>()

  private getNodeAtom(node: object) {
    return getOrCreate(this.nodeAtom, node, () => createAtom("contextValue"))
  }

  private fastGet(node: object): T {
    this.getNodeAtom(node).reportObserved()

    const obsForNode = this.nodeContextValue.get(node)
    if (obsForNode) {
      return getContextValue(obsForNode)
    }

    const parent = fastGetParent(node)
    if (!parent) {
      return this.getDefault()
    }

    return this.fastGet(parent)
  }

  get(node: object) {
    assertTweakedObject(node, "node")

    return this.fastGet(node)
  }

  private fastGetProviderNode(node: object): object | undefined {
    this.getNodeAtom(node).reportObserved()

    const obsForNode = this.nodeContextValue.get(node)
    if (obsForNode) {
      return node
    }

    const parent = fastGetParent(node)
    if (!parent) {
      return undefined
    }

    return this.fastGetProviderNode(parent)
  }

  getProviderNode(node: object): object | undefined {
    assertTweakedObject(node, "node")

    return this.fastGetProviderNode(node)
  }

  getDefault(): T {
    return getContextValue(this.defaultContextValue)
  }

  @action
  setDefault(value: T) {
    this.defaultContextValue = {
      type: "value",
      value,
    }
  }

  @action
  setDefaultComputed(valueFn: () => T) {
    this.defaultContextValue = {
      type: "computed",
      value: computed(valueFn),
    }
  }

  @action
  set(node: object, value: T) {
    assertTweakedObject(node, "node")

    this.nodeContextValue.set(node, {
      type: "value",
      value,
    })
    this.getNodeAtom(node).reportChanged()
  }

  @action
  setComputed(node: object, valueFn: () => T) {
    assertTweakedObject(node, "node")

    this.nodeContextValue.set(node, { type: "computed", value: computed(valueFn) })
    this.getNodeAtom(node).reportChanged()
  }

  @action
  unset(node: object) {
    assertTweakedObject(node, "node")

    this.nodeContextValue.delete(node)
    this.getNodeAtom(node).reportChanged()
  }

  constructor(defaultValue?: T) {
    if (getMobxVersion() >= 6) {
      mobx6.makeObservable(this)
    }

    this.setDefault(defaultValue as T)
  }
}

/**
 * Creates a new context with no default value, thus making its default value undefined.
 *
 * @typeparam T Context value type.
 * @returns
 */
export function createContext<T>(): Context<T | undefined>

/**
 * Creates a new context with a default value.
 *
 * @typeparam T Context value type.
 * @param defaultValue
 * @returns
 */
export function createContext<T>(defaultValue: T): Context<T>

// base
export function createContext<T>(defaultValue?: T): Context<T> {
  return new ContextClass(defaultValue)
}
