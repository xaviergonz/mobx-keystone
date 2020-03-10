import { failure } from "../utils"

/**
 * A function with an object as target.
 */
export type FnModelFn<T extends object, FN extends (...args: any[]) => any> = (
  target: T,
  ...args: Parameters<FN>
) => ReturnType<FN>

/**
 * An async function with an object as target.
 */
export type FnModelAsyncFn<
  T extends object,
  FN extends (...args: any[]) => Generator<any, any, any>
> = FN extends (...args: infer A) => Generator<any, infer R, any>
  ? (target: T, ...args: A) => Promise<R>
  : never

/**
 * @ignore
 * @internal
 */
export function assertFnModelKeyNotInUse(fnModelObj: any, key: string) {
  if (fnModelObj[key] !== undefined) {
    throw failure(`key '${key}' cannot be redeclared`)
  }
}
