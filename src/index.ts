export * from "./action"
export * from "./model"
export * from "./parent"
export * from "./patch"
export * from "./snapshot"
export * from "./rootStore"

// TODO: patch emitting thanks to immer? although fastjson patch is cool
// TODO: make applySnapshot NOT use fastjson patch?

// TODO: reactive getParentPath and friends?

// TODO: flows

// TODO: middlewares? (we have addActionMiddleware though)
// TODO: pre/post processors

// TODO: refs?
// TODO: readme, new name

// TODO: future: object/array backed map, array backed set?
// TODO: some kind of validation or rely on ts?
