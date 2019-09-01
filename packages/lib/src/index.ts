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
    [Symbol.iterator](): Generator<Promise<T>, T, unknown>
  }
}
