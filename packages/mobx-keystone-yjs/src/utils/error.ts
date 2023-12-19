/**
 * A mobx-keystone-yjs error.
 */
export class MobxKeystoneYjsError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, MobxKeystoneYjsError.prototype)
  }
}

/**
 * @internal
 */
export function failure(msg: string) {
  return new MobxKeystoneYjsError(msg)
}
