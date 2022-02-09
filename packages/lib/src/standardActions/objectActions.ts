import { isObservable, remove, set } from "mobx"
import { toTreeNode } from "../tweaker/tweak"
import { assertIsObject, namespace as ns } from "../utils"
import { standaloneAction } from "./standaloneActions"

const namespace = `${ns}/objectActions`

export const objectActions = {
  set: standaloneAction(
    `${namespace}::set`,
    <T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void => {
      if (isObservable(target)) {
        set(target, key, value)
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
          set(target, key, (partialObject as any)[key])
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
      ...args: T[K] extends (...args: any[]) => any ? Parameters<T[K]> : never
    ): T[K] extends (...args: any[]) => any ? ReturnType<T[K]> : never => {
      return (target as any)[methodName](...args)
    }
  ),

  create: <T extends object>(data: T): T => toTreeNode(data),
}
