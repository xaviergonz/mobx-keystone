import { remove, set } from "mobx"
import { fnModel } from "./fnModel"

function _splice(this: any[], start: number, deleteCount?: number): any[]
function _splice(this: any[], start: number, deleteCount: number, ...items: any[]): any[]
function _splice(this: any[], ...args: any[]): any[] {
  return (this.splice as any)(...args)
}

const _arrayActions = fnModel<unknown[]>("mobx-keystone/arrayActions").actions({
  set(index: number, value: any): void {
    set(this, index, value)
  },
  delete(index: number): boolean {
    return remove(this, "" + index)
  },
  setLength(length: number): void {
    this.length = length
  },
  swap(indexA, indexB: number): void {
    if (indexA < 0 || indexB < 0 || indexA > this.length - 1 || indexB > this.length - 1) {
      return
    }
    var tmp1 = this[indexA]
    var tmp2 = this[indexB]
    set(this, indexA, null)
    set(this, indexB, null)
    set(this, indexA, tmp2)
    set(this, indexB, tmp1)
  },
  concat(...items: ConcatArray<any>[]): any[] {
    return this.concat(...items)
  },
  copyWithin(target: number, start: number, end?: number | undefined): any[] {
    return this.copyWithin(target, start, end)
  },
  fill(value: unknown, start?: number | undefined, end?: number | undefined): any[] {
    return this.fill(value, start, end)
  },
  pop(): any | undefined {
    return this.pop()
  },
  push(...items: any[]): number {
    return this.push(...items)
  },
  reverse(): any[] {
    return this.reverse()
  },
  shift(): any | undefined {
    return this.shift()
  },
  slice(start?: number | undefined, end?: number | undefined): any[] {
    return this.slice(start, end)
  },
  sort(compareFn?: ((a: any, b: any) => number) | undefined): any[] {
    return this.sort(compareFn)
  },
  splice: _splice,
  unshift(...items: any[]): number {
    return this.unshift(...items)
  },
})

export const arrayActions = {
  set: _arrayActions.set as <T>(array: T[], index: number, value: T) => void,

  delete: _arrayActions.delete as <T>(array: T[], index: number) => boolean,

  setLength: _arrayActions.setLength as <T>(array: T[], length: number) => void,

  swap: _arrayActions.swap as <T>(array: T[], indexA: number, indexB: number) => void,

  concat: _arrayActions.concat as <T>(array: T[], ...items: ConcatArray<T>[]) => T[],

  copyWithin: _arrayActions.copyWithin as <T>(
    array: T[],
    target: number,
    start: number,
    end?: number | undefined
  ) => T[],

  fill: _arrayActions.fill as <T>(
    array: T[],
    value: T,
    start?: number | undefined,
    end?: number | undefined
  ) => T[],

  pop: _arrayActions.pop as <T>(array: T[]) => T | undefined,

  push: _arrayActions.push as <T>(array: T[], ...items: T[]) => number,

  reverse: _arrayActions.reverse as <T>(array: T[]) => T[],

  shift: _arrayActions.shift as <T>(array: T[]) => T | undefined,

  slice: _arrayActions.slice as <T>(
    array: T[],
    start?: number | undefined,
    end?: number | undefined
  ) => T[],

  sort: _arrayActions.sort as <T>(
    array: T[],
    compareFn?: ((a: T, b: T) => number) | undefined
  ) => T[],

  splice: _arrayActions.splice as
    | (<T>(array: T[], start: number, deleteCount?: number) => T[])
    | (<T>(array: T[], start: number, deleteCount: number, ...items: T[]) => T[]),

  unshift: _arrayActions.unshift as <T>(array: T[], ...items: T[]) => number,

  create: _arrayActions.create as <T>(data: T[]) => T[],
}
