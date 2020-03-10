import { remove, set } from "mobx"
import { fnModel } from "./fnModel"

function _splice(this: any[], start: number, deleteCount?: number): any[]
function _splice(this: any[], start: number, deleteCount: number, ...items: any[]): any[]
function _splice(this: any[], ...args: any[]): any[] {
  return (this.splice as any)(...args)
}

const _fnArray = fnModel<unknown[]>("mobx-keystone/fnArray").actions({
  set(index: number, value: any): void {
    set(this, index, value)
  },
  delete(index: number): boolean {
    return remove(this, "" + index)
  },
  setLength(length: number): void {
    this.length = length
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

export const fnArray = {
  set: _fnArray.set as <T>(array: T[], index: number, value: T) => void,

  delete: _fnArray.delete as <T>(array: T[], index: number) => boolean,

  setLength: _fnArray.setLength as <T>(array: T[], length: number) => void,

  concat: _fnArray.concat as <T>(array: T[], ...items: ConcatArray<T>[]) => T[],

  copyWithin: _fnArray.copyWithin as <T>(
    array: T[],
    target: number,
    start: number,
    end?: number | undefined
  ) => T[],

  fill: _fnArray.fill as <T>(
    array: T[],
    value: T,
    start?: number | undefined,
    end?: number | undefined
  ) => T[],

  pop: _fnArray.pop as <T>(array: T[]) => T | undefined,

  push: _fnArray.push as <T>(array: T[], ...items: T[]) => number,

  reverse: _fnArray.reverse as <T>(array: T[]) => T[],

  shift: _fnArray.shift as <T>(array: T[]) => T | undefined,

  slice: _fnArray.slice as <T>(
    array: T[],
    start?: number | undefined,
    end?: number | undefined
  ) => T[],

  sort: _fnArray.sort as <T>(array: T[], compareFn?: ((a: T, b: T) => number) | undefined) => T[],

  splice: _fnArray.splice as
    | (<T>(array: T[], start: number, deleteCount?: number) => T[])
    | (<T>(array: T[], start: number, deleteCount: number, ...items: T[]) => T[]),

  unshift: _fnArray.unshift as <T>(array: T[], ...items: T[]) => number,

  create: _fnArray.create as <T>(data: T[]) => T[],
}
