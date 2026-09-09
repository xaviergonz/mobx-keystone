import { indexModelSnapshots } from "@mobx-keystone/crdt-binding-common"
import { getSnapshotModelTypeAndId, isFrozenSnapshot } from "mobx-keystone"
import * as Y from "yjs"
import type { PlainValue } from "../plainTypes"
import { convertJsonToYjsData } from "./convertJsonToYjsData"

function isContainer(value: unknown): value is Y.Map<unknown> | Y.Array<unknown> | Y.Text {
  return value instanceof Y.Map || value instanceof Y.Array || value instanceof Y.Text
}

/**
 * Preserve ordered surviving containers while snapshot reconciliation inserts or removes items.
 * @internal
 */
export function reconcileYjsContainerPositions(
  container: unknown,
  before: unknown,
  after: unknown
): void {
  if (before === after) return
  if (container instanceof Y.Array && Array.isArray(before) && Array.isArray(after)) {
    // Leave unsupported arrays to the converter's validation before mutating them.
    if (
      after.includes(undefined) ||
      !before.some(
        (value) => value !== null && typeof value === "object" && !isFrozenSnapshot(value)
      )
    )
      return
    const original = container.toArray()
    const models = indexModelSnapshots(after)
    const references = new Map<object, number | undefined>()
    after.forEach((value, index) => {
      if (value !== null && typeof value === "object") {
        references.set(value, references.has(value) ? undefined : index)
      }
    })
    const anchors: { oldIndex: number; newIndex: number }[] = []
    const snapshots = new Map<unknown, unknown>()
    let ordered = true
    before.forEach((value, index) => {
      const item = original[index]
      if (!isContainer(item)) return
      snapshots.set(item, value)
      const model = getSnapshotModelTypeAndId(value)
      const newIndex =
        model?.modelId !== undefined
          ? models.get(model.modelType)?.get(model.modelId)?.index
          : references.get(value)
      if (newIndex === undefined) return
      if (anchors.length > 0 && anchors[anchors.length - 1].newIndex >= newIndex) ordered = false
      anchors.push({ oldIndex: index, newIndex })
    })
    let offset = 0
    let changed = false
    // Yjs cannot move integrated containers. Preserve their positions relative
    // to one another, adjusting only the intervening gaps when that is possible.
    if (ordered)
      for (const { oldIndex, newIndex } of anchors) {
        const currentIndex = oldIndex + offset
        if (newIndex > currentIndex) {
          for (let i = currentIndex; i < newIndex; i += 8192) {
            container.insert(
              i,
              after
                .slice(i, Math.min(i + 8192, newIndex))
                .map((value) => convertJsonToYjsData(value as PlainValue))
            )
          }
        } else if (newIndex < currentIndex) {
          container.delete(newIndex, currentIndex - newIndex)
        }
        offset += newIndex - currentIndex
        changed ||= newIndex !== currentIndex
      }
    const current = changed ? container.toArray() : original
    for (let i = 0; i < Math.min(current.length, after.length); i++) {
      if (snapshots.has(current[i]))
        reconcileYjsContainerPositions(current[i], snapshots.get(current[i]), after[i])
    }
  } else if (
    container instanceof Y.Map &&
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object"
  ) {
    for (const key of Object.keys(after)) {
      const previous = (before as Record<string, unknown>)[key]
      const next = (after as Record<string, unknown>)[key]
      if (previous !== next) reconcileYjsContainerPositions(container.get(key), previous, next)
    }
  }
}
