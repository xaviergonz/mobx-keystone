import type { IArrayDidChange, IObjectDidChange } from "mobx"

type TweakedChange = IArrayDidChange | IObjectDidChange

/**
 * @internal
 */
export interface TweakedChangeListener<C extends TweakedChange> {
  applyChange(change: C): void
  /**
   * Called when the target is tweaked again after being untweaked, since the
   * changes made in between were not received.
   */
  resync(): void
}

const changeListeners = new WeakMap<object, TweakedChangeListener<any>[]>()

/**
 * Listens to the changes of a tweaked array or plain object, in order, before
 * anything else reacts to them (including the type checks after the change).
 * Unlike `observe`, changes made while reacting to a change (such as a
 * type-check rollback) are received after it.
 *
 * @internal
 */
export function addTweakedChangeListener<T extends object>(
  target: T,
  listener: TweakedChangeListener<T extends readonly unknown[] ? IArrayDidChange : IObjectDidChange>
): void {
  let listeners = changeListeners.get(target)
  if (!listeners) {
    listeners = []
    changeListeners.set(target, listeners)
  }
  listeners.push(listener)
}

/**
 * @internal
 */
export function notifyTweakedChangeListeners(change: TweakedChange): void {
  const listeners = changeListeners.get(change.object)
  if (listeners) {
    for (const listener of listeners) {
      listener.applyChange(change)
    }
  }
}

/**
 * @internal
 */
export function resyncTweakedChangeListeners(target: object): void {
  const listeners = changeListeners.get(target)
  if (listeners) {
    for (const listener of listeners) {
      listener.resync()
    }
  }
}
