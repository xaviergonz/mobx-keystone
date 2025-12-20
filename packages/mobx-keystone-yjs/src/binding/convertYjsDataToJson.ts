import { action } from "mobx"
import { modelSnapshotOutWithMetadata } from "mobx-keystone"
import * as Y from "yjs"
import { PlainObject, PlainValue } from "../plainTypes"
import { YjsTextModel } from "./YjsTextModel"

export type YjsData = Y.Array<any> | Y.Map<any> | Y.Text | PlainValue

export const convertYjsDataToJson = action((yjsData: YjsData): PlainValue => {
  if (yjsData instanceof Y.Array) {
    return yjsData.map((v) => convertYjsDataToJson(v))
  }

  if (yjsData instanceof Y.Map) {
    const obj: PlainObject = {}
    yjsData.forEach((v, k) => {
      obj[k] = convertYjsDataToJson(v)
    })
    return obj
  }

  if (yjsData instanceof Y.Text) {
    const deltas = yjsData.toDelta() as unknown[]

    return modelSnapshotOutWithMetadata(YjsTextModel, {
      deltaList: deltas.length > 0 ? [{ $frozen: true, data: deltas }] : [],
    }) as unknown as PlainValue
  }

  // assume it's a primitive
  return yjsData
})
