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
  const assign = (target: object, key: string | number, value: unknown) => {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  const update = (value: unknown, event: LoroEvent, path: Path, index: number): unknown => {
    if (index < path.length) {
      const key = path[index]
      const result = copy(value as object)
      assign(result, key, update(result[key], event, path, index + 1))
      return result
    }
    if (event.diff.type === "map") {
      const result = copy(value as object)
      for (const [key, newValue] of Object.entries(event.diff.updated)) {
        if (newValue === undefined) delete result[key]
        else assign(result, key, convertLoroDataToJson(newValue as PlainValue, converted))
      }
      return result
    }
    if (event.diff.type === "list") {
      const previous = value as readonly unknown[]
      const result: unknown[] = []
      let oldIndex = 0
      for (const change of event.diff.diff) {
        const end = oldIndex + (change.retain ?? 0)
        while (oldIndex < end) result.push(previous[oldIndex++])
        oldIndex += change.delete ?? 0
        for (const item of change.insert ?? []) {
          result.push(convertLoroDataToJson(item as PlainValue, converted))
        }
      }
      while (oldIndex < previous.length) result.push(previous[oldIndex++])
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
