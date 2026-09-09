import { indexModelSnapshots } from "@mobx-keystone/crdt-binding-common"
import { type ContainerID, LoroMap, LoroMovableList } from "loro-crdt"
import { getSnapshotModelTypeAndId, isFrozenSnapshot } from "mobx-keystone"
import type { PlainValue } from "../plainTypes"
import { isBindableLoroContainer } from "../utils/isBindableLoroContainer"
import { convertJsonToLoroData } from "./convertJsonToLoroData"

/**
 * Preserve native model containers when the reentrant fallback reorders a list.
 * @internal
 */
export function reconcileLoroModelOrder(container: unknown, before: unknown, after: unknown): void {
  if (before === after) return
  if (container instanceof LoroMovableList && Array.isArray(before) && Array.isArray(after)) {
    if (
      after.includes(undefined) ||
      !before.some(
        (value) => value !== null && typeof value === "object" && !isFrozenSnapshot(value)
      )
    )
      return
    const models = indexModelSnapshots(before)
    const originalItems = container.toArray()
    const targets = after.map((snapshot) => {
      const model = getSnapshotModelTypeAndId(snapshot)
      const entry =
        model?.modelId === undefined ? undefined : models.get(model.modelType)?.get(model.modelId)
      const item = entry && originalItems[entry.index]
      return entry && isBindableLoroContainer(item) ? { item, snapshot: entry.snapshot } : undefined
    })
    const retainedIds = new Set(targets.flatMap((target) => (target ? [target.item.id] : [])))
    const originalSnapshots = new Map(
      originalItems.flatMap((item, index) =>
        isBindableLoroContainer(item) ? [[item.id, before[index]] as const] : []
      )
    )
    // Mirror the list while reordering it. Only these writes change it, and
    // asking the document where a container sits searches the whole document.
    const currentItems = originalItems.slice()
    const indexById = new Map<ContainerID, number>()
    const reindexFrom = (start: number) => {
      for (let i = start; i < currentItems.length; i++) {
        const item = currentItems[i]
        if (isBindableLoroContainer(item)) indexById.set(item.id, i)
      }
    }
    reindexFrom(0)
    for (let i = 0; i < after.length; i++) {
      const target = targets[i]
      if (target) {
        const index = indexById.get(target.item.id)
        if (index !== undefined && index !== i) {
          container.move(index, i)
          currentItems.splice(i, 0, ...currentItems.splice(index, 1))
          reindexFrom(Math.min(index, i))
        }
        reconcileLoroModelOrder(target.item, target.snapshot, after[i])
      } else {
        const current = i < currentItems.length ? currentItems[i] : undefined
        // Make room for new values without overwriting a model that moves later.
        if (
          i >= currentItems.length ||
          (isBindableLoroContainer(current) && retainedIds.has(current.id))
        ) {
          const converted = convertJsonToLoroData(after[i] as PlainValue)
          let inserted: unknown = converted
          if (isBindableLoroContainer(converted)) inserted = container.insertContainer(i, converted)
          else container.insert(i, converted)
          currentItems.splice(i, 0, inserted)
          reindexFrom(i)
        } else {
          reconcileLoroModelOrder(
            current,
            isBindableLoroContainer(current) ? originalSnapshots.get(current.id) : before[i],
            after[i]
          )
        }
      }
    }
  } else if (
    container instanceof LoroMap &&
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object"
  ) {
    for (const key of Object.keys(after)) {
      const previous = (before as Record<string, unknown>)[key]
      const next = (after as Record<string, unknown>)[key]
      if (previous !== next) reconcileLoroModelOrder(container.get(key), previous, next)
    }
  }
}
