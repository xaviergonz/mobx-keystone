import { remove, set } from "mobx"
import { fnModel } from "./fnModel"

const _fnObject = fnModel<any>("mobx-keystone/fnObject").actions({
  set(key: PropertyKey, value: any): void {
    set(this, key, value)
  },

  delete(key: PropertyKey): boolean {
    return remove(this, key)
  },

  call(methodName: PropertyKey, ...args: any[]): any {
    return this[methodName](...args)
  },
})

export const fnObject = {
  set: _fnObject.set as <T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K]
  ) => void,

  delete: _fnObject.delete as <T extends object, K extends keyof T>(target: T, key: K) => boolean,

  call: _fnObject.call as <T extends object, K extends keyof T>(
    target: T,
    methodName: K,
    ...args: T[K] extends (...args: any[]) => any ? Parameters<T[K]> : never
  ) => T[K] extends (...args: any[]) => any ? ReturnType<T[K]> : never,

  create: _fnObject.create as <T>(data: T) => T,
}
