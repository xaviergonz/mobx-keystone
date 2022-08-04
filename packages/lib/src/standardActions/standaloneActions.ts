import { addStandaloneAction } from "./actions"

/**
 * Creates a standalone action. A standalone action must always take an existing tree node as first argument.
 *
 * @param actionName Unique action name.
 * @param fn Function.
 * @returns The function as an standalone action.
 */
export function standaloneAction<FN extends (target: any, ...args: any[]) => any>(
  actionName: string,
  fn: FN
): FN {
  return addStandaloneAction(actionName, fn, false) as unknown as FN
}

/**
 * Creates a standalone flow. A standalone flow must always take an existing tree node as first argument.
 *
 * @param actionName Unique action name.
 * @param fn Function.
 * @returns The function as an standalone flow.
 */
export function standaloneFlow<TTarget, TArgs extends any[], TResult>(
  actionName: string,
  fn: (target: TTarget, ...args: TArgs) => Generator<any, TResult, any>
): (target: TTarget, ...args: TArgs) => Promise<TResult> {
  return addStandaloneAction(actionName, fn, true) as unknown as any
}
