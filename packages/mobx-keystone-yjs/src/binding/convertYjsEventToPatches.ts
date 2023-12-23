import { Patch } from "mobx-keystone"
import * as Y from "yjs"
import { JsonArray, JsonObject, JsonValue } from "../jsonTypes"
import { failure } from "../utils/error"

export function convertYjsEventToPatches(event: Y.YEvent<any>): Patch[] {
  const patches: Patch[] = []

  if (event instanceof Y.YMapEvent) {
    const source = event.target as Y.Map<any>

    event.changes.keys.forEach((change, key) => {
      const path = [...event.path, key]

      switch (change.action) {
        case "add":
          patches.push({
            op: "add",
            path,
            value: toPlainValue(source.get(key)),
          })
          break

        case "update":
          patches.push({
            op: "replace",
            path,
            value: toPlainValue(source.get(key)),
          })
          break

        case "delete":
          patches.push({
            op: "remove",
            path,
          })
          break

        default:
          throw failure(`unsupported Yjs map event action: ${change.action}`)
      }
    })
  } else if (event instanceof Y.YArrayEvent) {
    let retain = 0
    event.changes.delta.forEach((change) => {
      if (change.retain) {
        retain += change.retain
      }

      if (change.delete) {
        // remove X items at retain position
        const path = [...event.path, retain]
        for (let i = 0; i < change.delete; i++) {
          patches.push({
            op: "remove",
            path,
          })
        }
      }

      if (change.insert) {
        const newValues = Array.isArray(change.insert) ? change.insert : [change.insert]
        newValues.forEach((v) => {
          const path = [...event.path, retain]
          patches.push({
            op: "add",
            path,
            value: toPlainValue(v),
          })
          retain++
        })
      }
    })
  }

  return patches
}

function toPlainValue(v: Y.Map<any> | Y.Array<any> | JsonValue) {
  if (v instanceof Y.Map || v instanceof Y.Array) {
    return v.toJSON() as JsonObject | JsonArray
  } else {
    return v
  }
}
