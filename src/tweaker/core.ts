import { failure } from "../utils"

export const tweakedObjects = new WeakSet<Object>()

export function isTweakedObject(value: any): value is Object {
  return tweakedObjects.has(value)
}

export function assertTweakedObject(value: any, fnName: string): value is Object {
  if (!isTweakedObject(value)) {
    throw failure(
      `${fnName} only works over a model or a shallow / deep child part of a model 'data' object`
    )
  }
  return true
}
