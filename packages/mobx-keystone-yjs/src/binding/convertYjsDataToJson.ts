import { modelSnapshotOutWithMetadata } from "mobx-keystone"
import * as Y from "yjs"
import { JsonValue } from "../jsonTypes"
import { YjsTextModel } from "./YjsTextModel"

export function convertYjsDataToJson(
  yjsData: Y.Array<unknown> | Y.Map<unknown> | Y.Text | unknown
): JsonValue {
  if (yjsData instanceof Y.Array) {
    return yjsData.map((v) => convertYjsDataToJson(v))
  }

  if (yjsData instanceof Y.Map) {
    const obj: Record<string, JsonValue> = {}
    yjsData.forEach((v, k) => {
      obj[k] = convertYjsDataToJson(v)
    })
    return obj
  }

  if (yjsData instanceof Y.Text) {
    const deltas = yjsData.toDelta()

    return modelSnapshotOutWithMetadata(YjsTextModel, {
      deltaList: deltas.length > 0 ? [{ $frozen: true, data: deltas }] : [],
    }) as JsonValue
  }

  // assume it's a primitive
  return yjsData as JsonValue
}
