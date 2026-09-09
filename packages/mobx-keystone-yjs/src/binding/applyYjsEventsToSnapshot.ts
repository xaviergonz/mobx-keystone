import type { SnapshotOutOf } from "mobx-keystone"
import * as Y from "yjs"
import { convertYjsDataToJsonInternal } from "./convertYjsDataToJson"
import type { YjsTextModel } from "./YjsTextModel"

/**
 * Build an incoming snapshot while retaining unchanged snapshot references.
 * @internal
 */
export function applyYjsEventsToSnapshot(
  snapshot: unknown,
  events: Y.YEvent<any>[],
  pathOffset: number
): unknown {
  const owned = new WeakSet<object>()
  for (const event of events) {
    snapshot = updateSnapshot(snapshot, event, pathOffset, owned)
  }
  return snapshot
}

function copyForWrite(snapshot: object, owned: WeakSet<object>): object {
  if (owned.has(snapshot)) {
    return snapshot
  }
  const copy = Array.isArray(snapshot) ? snapshot.slice() : { ...snapshot }
  owned.add(copy)
  return copy
}

function updateSnapshot(
  snapshot: unknown,
  event: Y.YEvent<any>,
  pathIndex: number,
  owned: WeakSet<object>
): unknown {
  if (pathIndex < event.path.length) {
    const key = event.path[pathIndex]
    const copy = copyForWrite(snapshot as object, owned)
    // Define an own property so keys such as __proto__ remain ordinary data.
    Object.defineProperty(copy, key, {
      value: updateSnapshot(
        (snapshot as Record<string | number, unknown>)[key],
        event,
        pathIndex + 1,
        owned
      ),
      enumerable: true,
      configurable: true,
      writable: true,
    })
    return copy
  }

  if (event instanceof Y.YMapEvent) {
    const copy = copyForWrite(snapshot as object, owned) as Record<string, unknown>
    for (const [key, change] of event.changes.keys) {
      if (change.action === "delete") {
        delete copy[key]
      } else {
        Object.defineProperty(copy, key, {
          value: convertYjsDataToJsonInternal(event.target.get(key)),
          enumerable: true,
          configurable: true,
          writable: true,
        })
      }
    }
    return copy
  }

  if (event instanceof Y.YArrayEvent) {
    const oldArray = snapshot as readonly unknown[]
    const result: unknown[] = []
    let oldIndex = 0
    for (const change of event.changes.delta) {
      const retainEnd = oldIndex + (change.retain ?? 0)
      while (oldIndex < retainEnd) {
        result.push(oldArray[oldIndex++])
      }
      oldIndex += change.delete ?? 0
      if (change.insert) {
        for (const value of change.insert) {
          result.push(convertYjsDataToJsonInternal(value))
        }
      }
    }
    while (oldIndex < oldArray.length) {
      result.push(oldArray[oldIndex++])
    }
    owned.add(result)
    return result
  }

  if (event instanceof Y.YTextEvent && event.delta.length > 0) {
    const textSnapshot = snapshot as SnapshotOutOf<YjsTextModel>
    return {
      ...textSnapshot,
      deltaList: [...textSnapshot.deltaList, { $frozen: true, data: event.delta }],
    }
  }

  return snapshot
}
