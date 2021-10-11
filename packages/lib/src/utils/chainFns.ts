export function chainFns<F extends Function>(...fns: (F | undefined)[]): F | undefined {
  const definedFns = fns.filter((fn) => !!fn)
  if (definedFns.length <= 0) return undefined

  const chainedFn = (v: any, ...args: any[]) => {
    let ret = definedFns[0]!(v, ...args)

    for (let i = 1; i < definedFns.length; i++) {
      ret = definedFns[i]!(ret, ...args)
    }

    return ret
  }

  return chainedFn as unknown as F
}
