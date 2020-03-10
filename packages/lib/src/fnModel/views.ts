import { computed, IComputedValue, IEqualsComparer } from "mobx"
import { assertFnModelKeyNotInUse, FnModelFn } from "./core"

/**
 * A functional model view function definition.
 */
export type FnModelViewDef = () => any

/**
 * Functional model view function definition with options.
 */
export interface FnModelViewWithOptions {
  get: FnModelViewDef
  equals?: IEqualsComparer<any>
}

/**
 * An object with functional model view function definitions.
 */
export interface FnModelViewsDef {
  [k: string]: FnModelViewDef | FnModelViewWithOptions
}

/**
 * Functional model view functions.
 */
export type FnModelViews<Data extends object, ViewsDef extends FnModelViewsDef> = {
  [k in keyof ViewsDef]: FnModelFn<
    Data,
    ViewsDef[k] extends FnModelViewWithOptions
      ? ViewsDef[k]["get"]
      : ViewsDef[k] extends FnModelViewDef
      ? ViewsDef[k]
      : never
  >
}

/**
 * @ignore
 * @internal
 */
export function extendFnModelViews<Data>(fnModelObj: any, views: FnModelViewsDef): any {
  for (const [name, fnOrFnWithOptions] of Object.entries(views)) {
    assertFnModelKeyNotInUse(fnModelObj, name)

    const computedsPerObject = new WeakMap<any, IComputedValue<any>>()

    let fn: FnModelViewDef
    let equals: IEqualsComparer<any> | undefined
    if (typeof fnOrFnWithOptions === "function") {
      fn = fnOrFnWithOptions
    } else {
      fn = fnOrFnWithOptions.get
      equals = fnOrFnWithOptions.equals
    }

    fnModelObj[name] = (target: Data) => {
      let computedFn = computedsPerObject.get(target)
      if (!computedFn) {
        computedFn = computed(fn, {
          name,
          context: target,
          equals,
        })
        computedsPerObject.set(target, computedFn)
      }
      return computedFn.get()
    }
  }
  return fnModelObj
}
