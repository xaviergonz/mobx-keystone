import { type ContainerID, isContainer, LoroMap, LoroMovableList, LoroText } from "loro-crdt"
import { modelSnapshotOutWithMetadata, toFrozenSnapshot } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { failure } from "../utils/error"
import type { BindableLoroContainer } from "../utils/isBindableLoroContainer"
import { LoroTextModel } from "./LoroTextModel"

type LoroValue = BindableLoroContainer | PlainValue

/**
 * Converts Loro data to JSON-compatible format for mobx-keystone snapshots.
 *
 * @param value The Loro value to convert
 * @param convertedContainers Optionally records inlined containers during serialization,
 * avoiding a second traversal when suppressing redundant descendant events.
 * @returns JSON-compatible value
 * @internal
 */
export function convertLoroDataToJson(
  value: LoroValue,
  convertedContainers?: Set<ContainerID>
): PlainValue {
  if (value === null) {
    return null
  }

  if (typeof value !== "object") {
    if (value === undefined) {
      throw failure("undefined values are not supported by Loro")
    }

    return value as PlainValue
  }

  if (isContainer(value)) {
    convertedContainers?.add(value.id)
    if (value instanceof LoroMap) {
      return Object.fromEntries(
        value
          .entries()
          .map(([key, entry]) => [
            key,
            convertLoroDataToJson(entry as LoroValue, convertedContainers),
          ])
      )
    }

    if (value instanceof LoroMovableList) {
      return value
        .toArray()
        .map((entry) => convertLoroDataToJson(entry as LoroValue, convertedContainers))
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
    return value.map((item) => convertLoroDataToJson(item as LoroValue, convertedContainers))
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      convertLoroDataToJson(entry as LoroValue, convertedContainers),
    ])
  )
}
