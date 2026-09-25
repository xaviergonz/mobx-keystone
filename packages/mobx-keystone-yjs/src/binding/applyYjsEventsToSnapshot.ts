import {
  applyListDeltaToSnapshot,
  type ListDeltaPart,
  setOwnProperty,
} from "@mobx-keystone/crdt-binding-common"
import type { SnapshotOutOf } from "mobx-keystone"
import * as Y from "yjs"
import { convertYjsDataToJsonInternal, type YjsData } from "./convertYjsDataToJson"
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
    setOwnProperty(
      copy,
      key,
      updateSnapshot(
        (snapshot as Record<string | number, unknown>)[key],
        event,
        pathIndex + 1,
        owned
      )
    )
    return copy
  }

  if (event instanceof Y.YMapEvent) {
    const copy = copyForWrite(snapshot as object, owned) as Record<string, unknown>
    for (const [key, change] of event.changes.keys) {
      if (change.action === "delete") {
        delete copy[key]
      } else {
        setOwnProperty(copy, key, convertYjsDataToJsonInternal(event.target.get(key)))
      }
    }
    return copy
  }

  if (event instanceof Y.YArrayEvent) {
    const result = applyListDeltaToSnapshot(
      snapshot as readonly unknown[],
      // Array events never contain text inserts.
      event.changes.delta as ListDeltaPart[],
      (value) => convertYjsDataToJsonInternal(value as YjsData)
    )
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
