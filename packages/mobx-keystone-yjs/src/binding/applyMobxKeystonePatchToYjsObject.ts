import { Patch } from "mobx-keystone"
import { failure } from "../utils/error"
import * as Y from "yjs"
import { toYDataType } from "./toYDataType"

export function applyMobxKeystonePatchToYjsObject(patch: Patch, yjs: unknown): void {
  if (patch.path.length > 1) {
    const [key, ...rest] = patch.path

    if (yjs instanceof Y.Map) {
      const child = yjs.get(String(key))
      if (child === undefined) {
        throw failure(
          `invalid patch path, key "${key}" not found in Yjs map - patch: ${JSON.stringify(patch)}`
        )
      }
      applyMobxKeystonePatchToYjsObject({ ...patch, path: rest }, child)
    } else if (yjs instanceof Y.Array) {
      const child = yjs.get(Number(key))
      if (child === undefined) {
        throw failure(
          `invalid patch path, key "${key}" not found in Yjs array - patch: ${JSON.stringify(
            patch
          )}`
        )
      }
      applyMobxKeystonePatchToYjsObject({ ...patch, path: rest }, child)
    } else {
      throw failure(
        `invalid patch path, key "${key}" not found in unknown Yjs object - patch: ${JSON.stringify(
          patch
        )}`
      )
    }
  } else if (patch.path.length === 1) {
    if (yjs instanceof Y.Map) {
      const key = String(patch.path[0])

      switch (patch.op) {
        case "add":
        case "replace": {
          yjs.set(key, toYDataType(patch.value))
          break
        }
        case "remove": {
          yjs.delete(key)
          break
        }
        default: {
          throw failure(`invalid patch operation for map`)
        }
      }
    } else if (yjs instanceof Y.Array) {
      const key = patch.path[0]

      switch (patch.op) {
        case "replace": {
          if (key === "length") {
            if (yjs.length > patch.value) {
              const toDelete = yjs.length - patch.value
              yjs.delete(patch.value, toDelete)
            } else if (yjs.length < patch.value) {
              const toInsert = patch.value - yjs.length
              yjs.insert(yjs.length, Array(toInsert).fill(undefined))
            }
          } else {
            yjs.delete(Number(key))
            yjs.insert(Number(key), [toYDataType(patch.value)])
          }
          break
        }
        case "add": {
          yjs.insert(Number(key), [toYDataType(patch.value)])
          break
        }
        case "remove": {
          yjs.delete(Number(key))
          break
        }
        default: {
          throw failure(`invalid patch operation for array`)
        }
      }
    } else {
      throw failure(`invalid patch path, key ${patch.path[0]} not found in unknown object`)
    }
  } else {
    throw failure(`invalid patch path, it cannot be empty`)
  }
}
