import {
  action,
  computed,
  createAtom,
  IAtom,
  IComputedValue,
  IObservableValue,
  observable,
} from "mobx"
import { fastGetParent } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"

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
   * Gets the context value for a given node.
   * @param node
   */
  get(node: object): T

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
      value: IObservableValue<T>
    }
  | {
      type: "computed"
      value: IComputedValue<T>
    }

class ContextClass<T> implements Context<T> {
  private readonly defaultContextValue: IObservableValue<T>
  private readonly nodeContextValue = new WeakMap<object, ContextValue<T>>()
  private readonly nodeAtom = new WeakMap<object, IAtom>()

  private getNodeAtom(node: object) {
    let atomPerNode = this.nodeAtom.get(node)
    if (!atomPerNode) {
      atomPerNode = createAtom("contextValue")
      this.nodeAtom.set(node, atomPerNode)
    }
    return atomPerNode
  }

  private fastGet(node: object): T {
    this.getNodeAtom(node).reportObserved()

    const obsForNode = this.nodeContextValue.get(node)
    if (obsForNode) {
      return obsForNode.value.get()
    }

    const parent = fastGetParent(node)
    if (!parent) {
      return this.getDefault()
    }

    return this.fastGet(parent)
  }

  getDefault(): T {
    return this.defaultContextValue.get()
  }

  @action
  setDefault(value: T) {
    this.defaultContextValue.set(value)
  }

  @action
  set(node: object, value: T) {
    const obsForNode = this.nodeContextValue.get(node)
    if (!obsForNode || obsForNode.type !== "value") {
      this.nodeContextValue.set(node, {
        type: "value",
        value: observable.box(value, { deep: false }),
      })
    } else {
      obsForNode.value.set(value)
    }
    this.getNodeAtom(node).reportChanged()
  }

  @action
  setComputed(node: object, valueFn: () => T) {
    this.nodeContextValue.set(node, { type: "computed", value: computed(valueFn) })
    this.getNodeAtom(node).reportChanged()
  }

  @action
  unset(node: object) {
    this.nodeContextValue.delete(node)
    this.getNodeAtom(node).reportChanged()
  }

  get(node: object) {
    assertTweakedObject(node, "node")

    return this.fastGet(node)
  }

  constructor(defaultValue?: T) {
    this.defaultContextValue = observable.box(defaultValue, { deep: false })
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
