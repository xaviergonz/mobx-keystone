import { Patch } from "mobx-keystone"
import * as Y from "yjs"
import { failure } from "../utils/error"
import { convertJsonToYjsData } from "./convertJsonToYjsData"
import { JsonValueWithUndefined } from "../jsonTypes"

export function applyMobxKeystonePatchToYjsObject(patch: Patch, yjs: unknown): void {
  if (patch.path.length > 1) {
    const [key, ...rest] = patch.path

    if (yjs instanceof Y.Map) {
      const child = yjs.get(String(key)) as unknown
      if (child === undefined) {
        throw failure(
          `invalid patch path, key "${key}" not found in Yjs map - patch: ${JSON.stringify(patch)}`
        )
      }
      applyMobxKeystonePatchToYjsObject({ ...patch, path: rest }, child)
    } else if (yjs instanceof Y.Array) {
      const child = yjs.get(Number(key)) as unknown
      if (child === undefined) {
        throw failure(
          `invalid patch path, key "${key}" not found in Yjs array - patch: ${JSON.stringify(
            patch
          )}`
        )
      }
      applyMobxKeystonePatchToYjsObject({ ...patch, path: rest }, child)
    } else if (yjs instanceof Y.Text) {
      // changes to deltaList will be handled by the array observe in the YjsTextModel class
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
          yjs.set(key, convertJsonToYjsData(patch.value as JsonValueWithUndefined))
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
            const newLength = patch.value as number
            if (yjs.length > newLength) {
              const toDelete = yjs.length - newLength
              yjs.delete(newLength, toDelete)
            } else if (yjs.length < patch.value) {
              const toInsert = patch.value - yjs.length
              yjs.insert(yjs.length, Array(toInsert).fill(undefined))
            }
          } else {
            yjs.delete(Number(key))
            yjs.insert(Number(key), [convertJsonToYjsData(patch.value as JsonValueWithUndefined)])
          }
          break
        }
        case "add": {
          yjs.insert(Number(key), [convertJsonToYjsData(patch.value as JsonValueWithUndefined)])
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
    } else if (yjs instanceof Y.Text) {
      // initialization of a YjsTextModel, do nothing
    } else {
      throw failure(
        `invalid patch path, the Yjs object is of an unkown type, so key "${String(patch.path[0])}" cannot be found in it`
      )
    }
  } else {
    throw failure(`invalid patch path, it cannot be empty`)
  }
}
