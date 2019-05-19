import { SerializableActionCall } from "./onAction"
import { isObject, failure } from "../utils"

export function applyAction(target: object, call: SerializableActionCall): any {
  if (!isObject(target)) {
    throw failure("applyAction target must be an object")
  }

  // resolve path
  let current: any = target
  call.path.forEach(p => {
    current = current[p]
  })

  return current[call.name].apply(current, call.args)
}
