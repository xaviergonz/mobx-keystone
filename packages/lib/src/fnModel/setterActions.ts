import { addActionToFnModel, FnModelActionDef } from "./actions"
import { FnModelFn } from "./core"

/**
 * An array with functional model setter action definitions.
 */
export type FnModelSetterActionsArrayDef<Data> = ReadonlyArray<keyof Data & string>

/**
 * Array to functional model setter actions.
 */
export type FnModelSetterActionsArray<
  Data extends object,
  SetterActionsDef extends FnModelSetterActionsArrayDef<Data>
> = {
  [k in SetterActionsDef[number] as `set${Capitalize<k>}`]: FnModelFn<
    Data,
    (value: Data[k]) => void
  >
}

/**
 * @ignore
 * @internal
 */
export function extendFnModelSetterActions<Data>(
  fnModelObj: any,
  namespace: string,
  setterActions: {
    [k: string]: keyof Data
  }
): any {
  for (const [name, fieldName] of Object.entries(setterActions)) {
    // make strings setters
    const fn: FnModelActionDef = function (this: Data, value: any) {
      this[fieldName] = value
    }

    addActionToFnModel(fnModelObj, namespace, name, fn, false)
  }

  return fnModelObj
}
