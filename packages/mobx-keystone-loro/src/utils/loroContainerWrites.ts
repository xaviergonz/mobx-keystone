import type { LoroMap, LoroMovableList } from "loro-crdt"
import { isBindableLoroContainer } from "./isBindableLoroContainer"

// Loro stores detached containers through dedicated APIs, and plain values otherwise.

/** @internal */
export function setLoroMapValue(map: LoroMap, key: string, value: unknown): void {
  if (isBindableLoroContainer(value)) map.setContainer(key, value)
  else map.set(key, value)
}

/** @internal */
export function setLoroListValue(list: LoroMovableList, index: number, value: unknown): void {
  if (isBindableLoroContainer(value)) list.setContainer(index, value)
  else list.set(index, value)
}

/**
 * Inserts a value, returning the attached container when one was inserted.
 * @internal
 */
export function insertLoroListValue(list: LoroMovableList, index: number, value: unknown): unknown {
  if (isBindableLoroContainer(value)) return list.insertContainer(index, value)
  list.insert(index, value)
  return value
}
