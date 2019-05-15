export {
  ActionContext,
  getCurrentActionContext,
  isModelAction,
  modelAction,
  runUnprotected,
  addActionMiddleware,
  ActionMiddleware,
  ActionMiddlewareDisposer,
  ActionMiddlewareFilter,
} from "./action"
export { clone } from "./clone"
export { fromSnapshot } from "./fromSnapshot"
export { getSnapshot } from "./getSnapshot"
export { typeofKey } from "./metadata"
export { model, Model } from "./model"
export { onAction, SerializableAction } from "./onAction"
export { onPatch } from "./onPatch"
export { onSnapshot } from "./onSnapshot"
export {
  detach,
  getParent,
  getParentPath,
  getRoot,
  getRootPath,
  isChildOfParent,
  isParentOfChild,
  ParentPath,
  RootPath,
} from "./parent"
export * from "./SnapshotOf"

// TODO: patch emitting thanks to immer? although fastjson patch is cool and already has apply patches and all that
// TODO: apply patches

// TODO: walkTree
// TODO: construct works like oncreated, need onparentchange, how to attach stuf like effects? (or rather, dispose)
// TODO: flows

// TODO: middlewares? (we have addActionMiddleware though)
// TODO: env? (maybe we can just use a WeakMap?)
// TODO: pre/post processors

// TODO: refs?
// TODO: readme, new name

// TODO: object/array backed map, array backed set?
