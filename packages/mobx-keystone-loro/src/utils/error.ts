/**
 * A mobx-keystone-loro error.
 */
export class MobxKeystoneLoroError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, MobxKeystoneLoroError.prototype)
  }
}

/**
 * @internal
 */
export function failure(msg: string) {
  return new MobxKeystoneLoroError(msg)
}
