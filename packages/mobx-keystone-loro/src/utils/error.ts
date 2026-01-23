export class MobxKeystoneLoroError extends Error {
  constructor(msg: string) {
    super(msg)

    // Set the prototype explicitly for better instanceof support
    Object.setPrototypeOf(this, MobxKeystoneLoroError.prototype)
  }
}

export function failure(message: string): never {
  throw new MobxKeystoneLoroError(message)
}
