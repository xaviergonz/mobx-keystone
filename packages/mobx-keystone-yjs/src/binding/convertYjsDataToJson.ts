import { action } from "mobx"
import { modelSnapshotOutWithMetadata } from "mobx-keystone"
import * as Y from "yjs"
import type { PlainValue } from "../plainTypes"
import { YjsTextModel } from "./YjsTextModel"

export type YjsData = Y.Array<any> | Y.Map<any> | Y.Text | PlainValue

/** @internal */
export const convertYjsDataToJson = action(convertYjsDataToJsonInternal)

// Event handlers already run in a MobX action and can reuse the plain converter.
/** @internal */
export function convertYjsDataToJsonInternal(yjsData: YjsData): PlainValue {
  if (yjsData instanceof Y.Array) {
    return yjsData.map(convertYjsDataToJsonInternal)
  }

  if (yjsData instanceof Y.Map) {
    return Object.fromEntries(
      Array.from(yjsData.entries(), ([key, value]) => [key, convertYjsDataToJsonInternal(value)])
    )
  }

  if (yjsData instanceof Y.Text) {
    const deltas = yjsData.toDelta() as unknown[]

    return modelSnapshotOutWithMetadata(YjsTextModel, {
      deltaList: deltas.length > 0 ? [{ $frozen: true, data: deltas }] : [],
    }) as unknown as PlainValue
  }

  // assume it's a primitive
  return yjsData
}
