import { runInAction } from "mobx"

let actionProtection = true

export function getActionProtection() {
  return actionProtection
}
export function runUnprotected<T>(name: string, fn: () => T): T
export function runUnprotected<T>(fn: () => T): T
export function runUnprotected<T>(arg1: any, arg2?: any): T {
  const name = typeof arg1 === "string" ? arg1 : undefined
  const fn: () => T = typeof arg1 === "string" ? arg2 : arg1

  const oldActionProtection = actionProtection
  actionProtection = false
  try {
    if (name) {
      return runInAction(name, fn)
    } else {
      return runInAction(fn)
    }
  } finally {
    actionProtection = oldActionProtection
  }
}
