import { Model } from "../model/Model"
import { failure } from "../utils"
import { SerializableActionCall } from "./onAction"

/**
 * Applies (runs) a serialized action over a target model object.
 *
 * @export
 * @param rootTarget Root target model object to run the action over.
 * @param call The serialized action, usually as coming from onAction.
 * @returns The return value of the action, if any.
 */
export function applyAction<TRet = any>(rootTarget: Model, call: SerializableActionCall): TRet {
  if (!(rootTarget instanceof Model)) {
    throw failure("applyAction target must be a model object")
  }

  // resolve path
  let current: any = rootTarget
  call.path.forEach(p => {
    current = current[p]
  })

  return current[call.name].apply(current, call.args)
}
