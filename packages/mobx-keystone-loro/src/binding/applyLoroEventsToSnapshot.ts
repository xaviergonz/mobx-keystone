import { applyListDeltaToSnapshot, setOwnProperty } from "@mobx-keystone/crdt-binding-common"
import type { ContainerID, LoroDoc, LoroEvent } from "loro-crdt"
import type { Path } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { convertLoroDataToJson } from "./convertLoroDataToJson"

/**
 * Build the final snapshot without serializing unchanged branches.
 * @internal
 */
export function applyLoroEventsToSnapshot(
  snapshot: unknown,
  events: { event: LoroEvent; path: Path }[],
  pathOffset: number,
  doc: LoroDoc,
  converted: Set<ContainerID>
): unknown {
  const owned = new WeakSet<object>()
  const copy = (value: object): Record<string | number, unknown> => {
    if (owned.has(value)) return value as Record<string | number, unknown>
    const result = Array.isArray(value) ? value.slice() : { ...value }
    owned.add(result)
    return result as Record<string | number, unknown>
  }
  const update = (value: unknown, event: LoroEvent, path: Path, index: number): unknown => {
    if (index < path.length) {
      const key = path[index]
      const result = copy(value as object)
      setOwnProperty(result, key, update(result[key], event, path, index + 1))
      return result
    }
    if (event.diff.type === "map") {
      const result = copy(value as object)
      for (const [key, newValue] of Object.entries(event.diff.updated)) {
        if (newValue === undefined) delete result[key]
        else setOwnProperty(result, key, convertLoroDataToJson(newValue as PlainValue, converted))
      }
      return result
    }
    if (event.diff.type === "list") {
      const result = applyListDeltaToSnapshot(
        value as readonly unknown[],
        event.diff.diff,
        (item) => convertLoroDataToJson(item as PlainValue, converted)
      )
      owned.add(result)
      return result
    }
    // Text snapshots store current content rather than a history of edits.
    return convertLoroDataToJson(doc.getContainerById(event.target) as PlainValue, converted)
  }
  // Parent diffs establish final list indices. Inserted subtrees already include
  // their descendant changes and must not have those changes replayed.
  for (const { event, path } of [...events].sort((a, b) => a.path.length - b.path.length)) {
    if (!converted.has(event.target)) snapshot = update(snapshot, event, path, pathOffset)
  }
  return snapshot
}
