import { set } from "mobx"

export function setIfDifferent(target: any, key: PropertyKey, value: any): boolean {
  const oldValue = target[key]

  if (oldValue !== value || (value === undefined && !(key in target))) {
    set(target, key, value)
    return true
  }

  return false
}
