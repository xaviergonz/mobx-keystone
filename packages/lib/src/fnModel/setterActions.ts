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
  [k in keyof SetterActionsDef as `set${Capitalize<k & string>}`]: FnModelFn<
    Data,
    (value: Data[SetterActionsDef[k]]) => void
  >
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
    const fn: FnModelActionDef = function (this: Data, value: any) {
      this[fieldName] = value
    }

    addActionToFnModel(fnModelObj, namespace, name, fn, false)
  }

  return fnModelObj
}
