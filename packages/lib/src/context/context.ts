import { action, computed, createAtom, IAtom, IComputedValue, observable } from "mobx"
import { fastGetParent } from "../parent/path"
import { assertTweakedObject, isTweakedObject } from "../tweaker/core"
import { getOrCreate } from "../utils/mapUtils"
import { failure } from "../utils"

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

  private readonly throwOnDefault: boolean

  private overrideContextValue = observable.box<ContextValue<T> | undefined>(undefined, {
    deep: false,
  })

  private readonly nodeContextValue = new WeakMap<object, ContextValue<T>>()
  private readonly nodeAtom = new WeakMap<object, IAtom>()

  private reportNodeAtomObserved(node: object) {
    getOrCreate(this.nodeAtom, node, createContextValueAtom).reportObserved()
  }

  private reportNodeAtomChanged(node: object) {
    this.nodeAtom.get(node)?.reportChanged()
  }

  private fastGet(node: object, useAtom: boolean): T {
    if (useAtom) {
      this.reportNodeAtomObserved(node)
    }

    const obsForNode = this.nodeContextValue.get(node)
    if (obsForNode) {
      return resolveContextValue(obsForNode)
    }

    const parent = fastGetParent(node, useAtom)
    if (!parent) {
      const overrideValue = this.overrideContextValue.get()
      if (overrideValue) {
        return resolveContextValue(overrideValue)
      }
      return this.getDefault()
    }

    return this.fastGet(parent, useAtom)
  }

  get(node: object) {
    assertTweakedObject(node, "node")

    return this.fastGet(node, true)
  }

  private fastGetProviderNode(node: object, useAtom: boolean): object | undefined {
    if (useAtom) {
      this.reportNodeAtomObserved(node)
    }

    const obsForNode = this.nodeContextValue.get(node)
    if (obsForNode) {
      return node
    }

    const parent = fastGetParent(node, useAtom)
    if (!parent) {
      return undefined
    }

    return this.fastGetProviderNode(parent, useAtom)
  }

  getProviderNode(node: object): object | undefined {
    assertTweakedObject(node, "node")

    return this.fastGetProviderNode(node, true)
  }

  getDefault(): T {
    if (this.throwOnDefault) {
      throw failure("required contexts do not provide a default value")
    }

    return resolveContextValue(this.defaultContextValue.get()!)
  }

  setDefault = action((value: T) => {
    if (this.throwOnDefault) {
      throw failure("a required context cannot have a default value")
    }

    this.defaultContextValue.set({
      type: "value",
      value,
    })
  })

  setDefaultComputed = action((valueFn: () => T) => {
    if (this.throwOnDefault) {
      throw failure("a required context cannot have a default value")
    }

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
    this.reportNodeAtomChanged(node)
  })

  private _setComputed(node: object, computedValueFn: IComputedValue<T>) {
    assertTweakedObject(node, "node")

    this.nodeContextValue.set(node, { type: "computed", value: computedValueFn })
    this.reportNodeAtomChanged(node)
  }

  setComputed = action((node: object, valueFn: () => T) => {
    this._setComputed(node, computed(valueFn))
  })

  unset = action((node: object) => {
    assertTweakedObject(node, "node")

    this.nodeContextValue.delete(node)
    this.reportNodeAtomChanged(node)
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

  constructor({
    defaultValue,
    throwOnDefault,
  }: {
    defaultValue: T | undefined
    throwOnDefault: boolean
  }) {
    this.throwOnDefault = false
    this.setDefault(defaultValue as T)
    this.throwOnDefault = throwOnDefault
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
  return new ContextClass({ defaultValue, throwOnDefault: false })
}

/**
 * Creates a new context with a required non-default value, thus making it throw if it no node provides a value.
 *
 * @typeparam T Context value type.
 * @returns
 */
export function createRequiredContext<T>(): Context<T> {
  return new ContextClass<T>({ defaultValue: undefined, throwOnDefault: true })
}
