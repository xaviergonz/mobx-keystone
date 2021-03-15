import { remove, set } from "mobx"
import { assertIsObject } from "../utils"
import { fnModel } from "./fnModel"

const _objectActions = fnModel<any>("mobx-keystone/objectActions").actions({
  set(key: PropertyKey, value: any): void {
    set(this, key, value)
  },

  assign(partialObject: any): void {
    assertIsObject(partialObject, "partialObject")
    const keys = Object.keys(partialObject)
    for (const key of keys) {
      set(this, key, (partialObject as any)[key])
    }
  },

  delete(key: PropertyKey): boolean {
    return remove(this, key)
  },

  call(methodName: PropertyKey, ...args: any[]): any {
    return this[methodName](...args)
  },
})

export const objectActions = {
  set: _objectActions.set as <T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K]
  ) => void,

  assign: _objectActions.assign as <T extends object>(target: T, partialObject: Partial<T>) => void,

  delete: _objectActions.delete as <T extends object, K extends keyof T>(
    target: T,
    key: K
  ) => boolean,

  call: _objectActions.call as <T extends object, K extends keyof T>(
    target: T,
    methodName: K,
    ...args: T[K] extends (...args: any[]) => any ? Parameters<T[K]> : never
  ) => T[K] extends (...args: any[]) => any ? ReturnType<T[K]> : never,

  create: _objectActions.create as <T>(data: T) => T,
}
