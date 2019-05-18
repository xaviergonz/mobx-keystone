import * as fsp from "fast-json-patch"
import { isObservableArray } from "mobx"
import { getCurrentActionContext } from "../action/context"
import { getActionProtection } from "../action/protection"
import { Model } from "../model/Model"
import { fromSnapshot } from "../snapshot/fromSnapshot"
import { PatchOperation } from "./PatchOperation"
import { isObject } from "../utils"

export function applyPatches(obj: object, patches: PatchOperation[]): void {
  if (getActionProtection() && !getCurrentActionContext()) {
    throw fail("applyPatch must be run inside an action")
  }

  if (!isObject(obj)) {
    throw fail("applyPatches target must be an object")
  }

  if (patches.length <= 0) return

  patches.forEach(patch => applySinglePatch(obj, patch))
}

function applySinglePatch(obj: object, patch: PatchOperation): void {
  const { target, prop } = jsonPathToObjectAndProp(obj, patch.path)

  if (Array.isArray(target) || isObservableArray(target)) {
    let index = +prop!

    switch (patch.op) {
      case "add": {
        // no reconciliation, new value
        target.splice(index, 0, fromSnapshot(patch.value))
        break
      }

      case "remove": {
        // no reconciliation, removing
        target.splice(index, 1)
        break
      }

      case "replace": {
        // TODO: should this be reconciliated?
        target[index] = fromSnapshot(patch.value)
        break
      }

      default:
        throw fail(`unsupported patch operation: ${(patch as any).op}`)
    }
  } else {
    switch (patch.op) {
      case "add": {
        // no reconciliation, new value
        target[prop!] = fromSnapshot(patch.value)
        break
      }

      case "remove": {
        // no reconciliation, removing
        delete target[prop!]
        break
      }

      case "replace": {
        // TODO: should this be reconciliated?
        target[prop!] = fromSnapshot(patch.value)
        break
      }

      default:
        throw fail(`unsupported patch operation: ${(patch as any).op}`)
    }
  }
}

function jsonPathToObjectAndProp(obj: object, jsonPath: string): { target: any; prop?: string } {
  if (process.env.NODE_ENV !== "production") {
    if (typeof jsonPath !== "string") {
      throw fail(`invalid json path: ${jsonPath}`)
    }
  }

  if (jsonPath === "") {
    return {
      target: obj,
    }
  }

  if (process.env.NODE_ENV !== "production") {
    if (!jsonPath.startsWith("/")) {
      throw fail(`invalid json path: ${jsonPath}`)
    }
  }

  const path: string[] = jsonPath
    .split("/")
    .slice(1)
    .map(fsp.unescapePathComponent)

  let target: any = obj
  if (target instanceof Model) {
    target = target.data
  }
  for (let i = 0; i <= path.length - 2; i++) {
    target = target[path[i]]
    if (target instanceof Model) {
      target = target.data
    }
  }

  return {
    target,
    prop: path[path.length - 1],
  }
}
