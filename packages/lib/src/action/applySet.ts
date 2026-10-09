import { isObservable } from "mobx"
import { isModel } from "../model/utils"
import { assertTweakedObject } from "../tweaker/core"
import { failure, hasOwnProp, lazy } from "../utils"
import { setIfDifferent } from "../utils/setIfDifferent"
import { BuiltInAction } from "./builtInActions"
import { ActionContextActionType } from "./context"
import { wrapInAction } from "./wrapInAction"

/**
 * Sets an object field wrapped in an action.
 *
 * @param node  Target object.
 * @param fieldName Field name.
 * @param value Value to set.
 */
export function applySet<O extends object, K extends keyof O, V extends O[K]>(
  node: O,
  fieldName: K,
  value: V
): void {
  assertTweakedObject(node, "node", true)

  wrappedInternalApplySet().call(node, fieldName as string | number, value)
}

function internalApplySet<O extends object>(this: O, fieldName: string | number, value: any): void {
  // we need to check if it is a model since models can become observable objects
  // (e.g. by having a computed value)
  if (!isModel(this) && isObservable(this)) {
    setIfDifferent(this, fieldName, value)
  } else {
    // assigning '__proto__' would replace the prototype of the model instead of setting a field,
    // and assigning an inherited method (e.g. an action) would shadow it on this instance
    if (fieldName === "__proto__" || isInheritedDataProp(this, fieldName)) {
      throw failure(`applySet cannot set '${String(fieldName)}' on a model`)
    }
    ;(this as any)[fieldName] = value
  }
}

function isInheritedDataProp(obj: object, fieldName: string | number): boolean {
  if (hasOwnProp(obj, fieldName)) {
    return false
  }
  let proto = Object.getPrototypeOf(obj)
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, fieldName)
    if (descriptor) {
      return !descriptor.get && !descriptor.set
    }
    proto = Object.getPrototypeOf(proto)
  }
  return false
}

const wrappedInternalApplySet = lazy(() =>
  wrapInAction({
    nameOrNameFn: BuiltInAction.ApplySet,
    fn: internalApplySet,
    actionType: ActionContextActionType.Sync,
  })
)
