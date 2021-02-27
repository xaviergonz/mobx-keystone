import { addActionToFnModel } from "./actions"
import type { FnModelAsyncFn } from "./core"

/**
 * Functional model flow action definition.
 */
export type FnModelFlowActionDef = (...args: any[]) => Generator<any, any, any>

/**
 * An object with functional model flow action definitions.
 */
export interface FnModelFlowActionsDef {
  [k: string]: FnModelFlowActionDef
}

/**
 * Functional model flow actions.
 */
export type FnModelFlowActions<
  Data extends object,
  FlowActionsDef extends FnModelFlowActionsDef
> = {
  [k in keyof FlowActionsDef]: FnModelAsyncFn<Data, FlowActionsDef[k]>
}

/**
 * @ignore
 * @internal
 */
export function extendFnModelFlowActions(
  fnModelObj: any,
  namespace: string,
  flowActions: FnModelFlowActionsDef
): any {
  for (const [name, fn] of Object.entries(flowActions)) {
    addActionToFnModel(fnModelObj, namespace, name, fn, true)
  }

  return fnModelObj
}
