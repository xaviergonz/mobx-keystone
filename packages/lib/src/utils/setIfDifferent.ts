import { set } from "mobx"

export function setIfDifferent(target: any, key: PropertyKey, value: unknown): void {
  if (target[key] !== value || !(key in target)) {
    set(target, key, value)
  }
}

export function setIfDifferentWithReturn(target: any, key: PropertyKey, value: unknown): boolean {
  if (target[key] !== value || !(key in target)) {
    set(target, key, value)
    return true
  }

  return false
}
