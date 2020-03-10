import { addActionToFnModel, FnModelActionDef } from "./actions"
import { FnModelFn } from "./core"

/**
 * An object with functional model setter action definitions.
 */
export interface FnModelSetterActionsDef<Data> {
  [k: string]: keyof Data
}

/**
 * Functional model setter actions.
 */
export type FnModelSetterActions<
  Data extends object,
  SetterActionsDef extends FnModelSetterActionsDef<Data>
> = {
  [k in keyof SetterActionsDef]: FnModelFn<Data, (value: Data[SetterActionsDef[k]]) => void>
}

/**
 * @ignore
 * @internal
 */
export function extendFnModelSetterActions<Data>(
  fnModelObj: any,
  namespace: string,
  setterActions: FnModelSetterActionsDef<Data>
): any {
  for (const [name, fieldName] of Object.entries(setterActions)) {
    // make strings setters
    const fn: FnModelActionDef = function(this: Data, value: any) {
      this[fieldName] = value
    }

    addActionToFnModel(fnModelObj, namespace, name, fn, false)
  }

  return fnModelObj
}
