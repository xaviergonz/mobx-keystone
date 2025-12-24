import { LoroMap, LoroMovableList, LoroText } from "loro-crdt"

/**
 * A bindable Loro container (Map, MovableList, or Text).
 */
export type BindableLoroContainer = LoroMap | LoroMovableList | LoroText

/**
 * Checks if a value is a bindable Loro container.
 */
export function isBindableLoroContainer(value: unknown): value is BindableLoroContainer {
  return value instanceof LoroMap || value instanceof LoroMovableList || value instanceof LoroText
}
