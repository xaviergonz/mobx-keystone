import { set } from "mobx"
import { isEqualOrBothNaN } from "./index"

export function setIfDifferent(target: any, key: PropertyKey, value: unknown): void {
  if (!isEqualOrBothNaN(target[key], value) || !(key in target)) {
    set(target, key, value)
  }
}

export function setIfDifferentWithReturn(target: any, key: PropertyKey, value: unknown): boolean {
  if (!isEqualOrBothNaN(target[key], value) || !(key in target)) {
    set(target, key, value)
    return true
  }

  return false
}
