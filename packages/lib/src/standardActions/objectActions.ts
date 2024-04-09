import { isObservable, remove } from "mobx"
import { toTreeNode } from "../tweaker/tweak"
import { assertIsObject, namespace as ns } from "../utils"
import { setIfDifferent } from "../utils/setIfDifferent"
import { standaloneAction } from "./standaloneActions"
import { AnyFunction } from "../utils/AnyFunction"

const namespace = `${ns}/objectActions`

export const objectActions = {
  set: standaloneAction(
    `${namespace}::set`,
    <T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void => {
      if (isObservable(target)) {
        setIfDifferent(target, key, value)
      } else {
        target[key] = value
      }
    }
  ),

  assign: standaloneAction(
    `${namespace}::assign`,
    <T extends object>(target: T, partialObject: Partial<T>): void => {
      assertIsObject(partialObject, "partialObject")
      const keys = Object.keys(partialObject)

      if (isObservable(target)) {
        for (const key of keys) {
          const newValue = (partialObject as any)[key]
          setIfDifferent(target, key, newValue)
        }
      } else {
        for (const key of keys) {
          ;(target as any)[key] = (partialObject as any)[key]
        }
      }
    }
  ),

  delete: standaloneAction(
    `${namespace}::delete`,
    <T extends object, K extends keyof T>(target: T, key: K): boolean => {
      return remove(target, key as any)
    }
  ),

  call: standaloneAction(
    `${namespace}::call`,
    <T extends object, K extends keyof T>(
      target: T,
      methodName: K,
      ...args: T[K] extends AnyFunction ? Parameters<T[K]> : never
    ): T[K] extends AnyFunction ? ReturnType<T[K]> : never => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return (target as any)[methodName](...args)
    }
  ),

  create: <T extends object>(data: T): T => toTreeNode(data),
}
