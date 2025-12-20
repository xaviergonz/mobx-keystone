import * as Y from "yjs"

/**
 * Checks if a Y.js value has been deleted or its document destroyed.
 *
 * @param yjsValue The Y.js value to check.
 * @returns `true` if the value is deleted or destroyed, `false` otherwise.
 */
export function isYjsValueDeleted(yjsValue: unknown): boolean {
  if (yjsValue instanceof Y.AbstractType) {
    return !!(yjsValue as any)._item?.deleted || !!yjsValue.doc?.isDestroyed
  }
  return false
}
