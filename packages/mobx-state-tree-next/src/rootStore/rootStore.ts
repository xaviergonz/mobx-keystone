import { action } from "mobx"
import { Model } from "../model/Model"
import { getParent, getRoot } from "../parent/path"
import { assertTweakedObject } from "../tweaker/core"
import { failure, isPlainObject } from "../utils"
import { attachToRootStore, detachFromRootStore } from "./attachDetach"

const rootStores = new WeakMap<
  Model,
  {
    env: any
  }
>()

export const registerRootStore = action(
  "registerRootStore",
  <T extends Model>(
    model: T,
    options?: {
      env?: any
    }
  ): T => {
    const opts = {
      env: {},
      ...options,
    }

    if (!(model instanceof Model)) {
      throw failure("a root store must be a model")
    }

    if (rootStores.has(model)) {
      throw failure("model already marked as root store")
    }

    if (getParent(model)) {
      throw failure("a root store must not have a parent")
    }

    if (!isPlainObject(opts.env)) {
      throw failure("env must be a plain object or undefined")
    }

    rootStores.set(model, {
      env: opts.env,
    })

    attachToRootStore(model, model)

    return model
  }
)

export const unregisterRootStore = action(
  "unregisterRootStore",
  (model: Model): void => {
    if (!isRootStore(model)) {
      throw failure("not a root store")
    }

    rootStores.delete(model)

    detachFromRootStore(model)
  }
)

export function isRootStore(model: Model): boolean {
  return rootStores.has(model as any)
}

export function getRootStore<T extends Model = Model>(target: object): T | undefined {
  assertTweakedObject(target, "getRootStore")

  const root = getRoot(target)
  return isRootStore(root) ? root : undefined
}

export function getRootStoreEnv<T extends object = any>(target: object): T | undefined {
  assertTweakedObject(target, "getRootStoreEnv")

  const root = getRoot(target)
  const rootStoreData = rootStores.get(root)
  return rootStoreData ? rootStoreData.env : undefined
}
