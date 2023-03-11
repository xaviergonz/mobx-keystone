import { action, computed, createAtom, IAtom, IComputedValue, observable } from "mobx"
import { fastGetParent } from "../parent/path"
import { assertTweakedObject, isTweakedObject } from "../tweaker/core"
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

  /**
   * Applies a value override while the given function is running and, if a node is returned,
   * sets the node as a provider of the value.
   *
   * @typeparam R
   * @param fn Function to run.
   * @param value Value to apply.
   * @returns The value returned from the function.
   */
  apply<R>(fn: () => R, value: T): R

  /**
   * Applies a computed value override while the given function is running and, if a node is returned,
   * sets the node as a provider of the computed value.
   *
   * @typeparam R
   * @param fn Function to run.
   * @param value Value to apply.
   * @returns The value returned from the function.
   */
  applyComputed<R>(fn: () => R, valueFn: () => T): R
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

function resolveContextValue<T>(contextValue: ContextValue<T>): T {
  if (contextValue.type === "value") {
    return contextValue.value
  } else {
    return contextValue.value.get()
  }
}

const createContextValueAtom = () => createAtom("contextValue")

class ContextClass<T> implements Context<T> {
  private defaultContextValue = observable.box<ContextValue<T>>(undefined, { deep: false })

  private overrideContextValue = observable.box<ContextValue<T> | undefined>(undefined, {
    deep: false,
  })

  private readonly nodeContextValue = new WeakMap<object, ContextValue<T>>()
  private readonly nodeAtom = new WeakMap<object, IAtom>()

  private getNodeAtom(node: object) {
    return getOrCreate(this.nodeAtom, node, createContextValueAtom)
  }

  private fastGet(node: object): T {
    this.getNodeAtom(node).reportObserved()

    const obsForNode = this.nodeContextValue.get(node)
    if (obsForNode) {
      return resolveContextValue(obsForNode)
    }

    const parent = fastGetParent(node)
    if (!parent) {
      const overrideValue = this.overrideContextValue.get()
      if (overrideValue) {
        return resolveContextValue(overrideValue)
      }
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
    return resolveContextValue(this.defaultContextValue.get()!)
  }

  setDefault = action((value: T) => {
    this.defaultContextValue.set({
      type: "value",
      value,
    })
  })

  setDefaultComputed = action((valueFn: () => T) => {
    this.defaultContextValue.set({
      type: "computed",
      value: computed(valueFn),
    })
  })

  set = action((node: object, value: T) => {
    assertTweakedObject(node, "node")

    this.nodeContextValue.set(node, {
      type: "value",
      value,
    })
    this.getNodeAtom(node).reportChanged()
  })

  private _setComputed(node: object, computedValueFn: IComputedValue<T>) {
    assertTweakedObject(node, "node")

    this.nodeContextValue.set(node, { type: "computed", value: computedValueFn })
    this.getNodeAtom(node).reportChanged()
  }

  setComputed = action((node: object, valueFn: () => T) => {
    this._setComputed(node, computed(valueFn))
  })

  unset = action((node: object) => {
    assertTweakedObject(node, "node")

    this.nodeContextValue.delete(node)
    this.getNodeAtom(node).reportChanged()
  })

  apply = action(<R>(fn: () => R, value: T): R => {
    const old = this.overrideContextValue.get()
    this.overrideContextValue.set({
      type: "value",
      value,
    })

    try {
      const ret = fn()
      if (isTweakedObject(ret, true)) {
        this.set(ret, value)
      }
      return ret
    } finally {
      this.overrideContextValue.set(old)
    }
  })

  applyComputed = action(<R>(fn: () => R, valueFn: () => T): R => {
    const computedValueFn = computed(valueFn)

    const old = this.overrideContextValue.get()
    this.overrideContextValue.set({
      type: "computed",
      value: computedValueFn,
    })

    try {
      const ret = fn()
      if (isTweakedObject(ret, true)) {
        this._setComputed(ret, computedValueFn)
      }
      return ret
    } finally {
      this.overrideContextValue.set(old)
    }
  })

  constructor(defaultValue?: T) {
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
