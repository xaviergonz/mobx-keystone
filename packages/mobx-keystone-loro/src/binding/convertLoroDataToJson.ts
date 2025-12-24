import { isContainer, LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { modelSnapshotOutWithMetadata, toFrozenSnapshot } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import { type BindableLoroContainer } from "../utils/isBindableLoroContainer"
import { LoroTextModel } from "./LoroTextModel"

type LoroValue = BindableLoroContainer | PlainValue

/**
 * Converts Loro data to JSON-compatible format for mobx-keystone snapshots.
 *
 * @param value The Loro value to convert
 * @returns JSON-compatible value
 */
export function convertLoroDataToJson(value: LoroValue): PlainValue {
  if (value === null) {
    return null
  }

  if (typeof value !== "object") {
    if (value === undefined) {
      throw new Error("undefined values are not supported by Loro")
    }

    return value as PlainValue
  }

  if (isContainer(value)) {
    if (value instanceof LoroMap) {
      const result: Record<string, PlainValue> = {}
      for (const [k, v] of value.entries()) {
        result[k] = convertLoroDataToJson(v as LoroValue)
      }
      return result
    }

    if (value instanceof LoroMovableList) {
      const result: PlainValue[] = []
      for (let i = 0; i < value.length; i++) {
        result.push(convertLoroDataToJson(value.get(i) as LoroValue))
      }
      return result
    }

    if (value instanceof LoroText) {
      const deltas = value.toDelta()
      // Return a LoroTextModel-compatible snapshot
      return modelSnapshotOutWithMetadata(LoroTextModel, {
        deltaList: toFrozenSnapshot(deltas),
      }) as unknown as PlainValue
    }

    throw failure(`unsupported bindable Loro container type`)
  }

  // Plain object or array
  if (Array.isArray(value)) {
    return value.map((item) => convertLoroDataToJson(item as LoroValue))
  }

  const result: Record<string, PlainValue> = {}
  for (const [k, v] of Object.entries(value)) {
    result[k] = convertLoroDataToJson(v as LoroValue)
  }

  return result
}
