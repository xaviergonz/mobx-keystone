import { Patch } from "mobx-keystone"
import * as Y from "yjs"
import { failure } from "../utils/error"
import { convertYjsDataToJson } from "./convertYjsDataToJson"

export function convertYjsEventToPatches(event: Y.YEvent<any>): Patch[] {
  const patches: Patch[] = []

  if (event instanceof Y.YMapEvent) {
    const source = event.target

    event.changes.keys.forEach((change, key) => {
      const path = [...event.path, key]

      switch (change.action) {
        case "add":
          patches.push({
            op: "add",
            path,
            value: convertYjsDataToJson(source.get(key)),
          })
          break

        case "update":
          patches.push({
            op: "replace",
            path,
            value: convertYjsDataToJson(source.get(key)),
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
            value: convertYjsDataToJson(v),
          })
          retain++
        })
      }
    })
  } else if (event instanceof Y.YTextEvent) {
    const path = [...event.path, "deltaList", -1 /* last item */]
    patches.push({
      op: "add",
      path,
      value: { $frozen: true, data: event.delta },
    })
  }

  return patches
}
