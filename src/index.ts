export * from "./action"
export * from "./model"
export * from "./parent"
export * from "./patch"
export * from "./snapshot"

// TODO: patch emitting thanks to immer? although fastjson patch is cool and already has apply patches and all that
// TODO: apply patches / snapshots (reconciliation?)

// TODO: walkTree
// TODO: construct works like oncreated, need onparentchange, how to attach stuf like effects? (or rather, dispose)
// TODO: flows

// TODO: middlewares? (we have addActionMiddleware though)
// TODO: env? (maybe we can just use a WeakMap?)
// TODO: pre/post processors

// TODO: refs?
// TODO: readme, new name

// TODO: object/array backed map, array backed set?
