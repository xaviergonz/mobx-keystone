export * from "./action"
export * from "./actionMiddlewares"
export * from "./frozen"
export * from "./globalConfig"
export * from "./model"
export * from "./parent"
export * from "./patch"
export * from "./redux"
export * from "./ref"
export * from "./rootStore"
export * from "./snapshot"
export * from "./tweaker"
export * from "./typeChecking"
export { MobxKeystoneError } from "./utils"
export * from "./wrappers"

declare global {
  // used to make yield* work over promises (for flows)
  // which is actually polyfilled in modelFlow.ts
  interface Promise<T> {
    [Symbol.iterator](): Generator<Promise<T>, T, T>
  }

  interface OriginalGenerator<T = unknown, TReturn = any, TNext = unknown>
    extends Iterator<T, TReturn, TNext> {
    // NOTE: 'next' is defined using a tuple to ensure we report the correct assignability errors in all places.
    next(...args: [] | [TNext]): IteratorResult<T, TReturn>
    return(value: TReturn): IteratorResult<T, TReturn>
    throw(e: any): IteratorResult<T, TReturn>
    [Symbol.iterator](): OriginalGenerator<T, TReturn, TNext>
  }

  // used to make generators awaitable
  interface Generator<T, TReturn, TNext> extends PromiseLike<TReturn> {}
}
