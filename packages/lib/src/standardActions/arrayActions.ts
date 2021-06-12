import { remove, set } from "mobx"
import { toTreeNode } from "../tweaker/tweak"
import { standaloneAction } from "./standaloneActions"

function _splice(array: any[], start: number, deleteCount?: number): any[]
function _splice(array: any[], start: number, deleteCount: number, ...items: any[]): any[]
function _splice(array: any[], ...args: any[]): any[] {
  return (array.splice as any)(...args)
}

const namespace = "mobx-keystone/arrayActions"

export const arrayActions = {
  set: standaloneAction(`${namespace}::set`, <T>(array: T[], index: number, value: any): void => {
    set(array, index, value)
  }),

  delete: standaloneAction(`${namespace}::delete`, <T>(array: T[], index: number): boolean => {
    return remove(array, "" + index)
  }),

  setLength: standaloneAction(`${namespace}::setLength`, <T>(array: T[], length: number): void => {
    array.length = length
  }),

  concat: standaloneAction(
    `${namespace}::concat`,
    <T>(array: T[], ...items: ConcatArray<T>[]): T[] => {
      return array.concat(...items)
    }
  ),

  copyWithin: standaloneAction(
    `${namespace}::copyWithin`,
    <T>(array: T[], target: number, start: number, end?: number | undefined): T[] => {
      return array.copyWithin(target, start, end)
    }
  ),

  fill: standaloneAction(
    `${namespace}::fill`,
    <T>(array: T[], value: T, start?: number | undefined, end?: number | undefined): T[] => {
      return array.fill(value, start, end)
    }
  ),

  pop: standaloneAction(`${namespace}::pop`, <T>(array: T[]): T | undefined => {
    return array.pop()
  }),

  push: standaloneAction(`${namespace}::push`, <T>(array: T[], ...items: T[]): number => {
    return array.push(...items)
  }),

  reverse: standaloneAction(`${namespace}::reverse`, <T>(array: T[]): T[] => {
    return array.reverse()
  }),

  shift: standaloneAction(`${namespace}::shift`, <T>(array: T[]): T | undefined => {
    return array.shift()
  }),

  slice: standaloneAction(
    `${namespace}::slice`,
    <T>(array: T[], start?: number | undefined, end?: number | undefined): T[] => {
      return array.slice(start, end)
    }
  ),

  sort: standaloneAction(
    `${namespace}::sort`,
    <T>(array: T[], compareFn?: ((a: T, b: T) => number) | undefined): T[] => {
      return array.sort(compareFn)
    }
  ),

  splice: standaloneAction(
    `${namespace}::splice`,
    _splice as
      | (<T>(array: T[], start: number, deleteCount?: number) => T[])
      | (<T>(array: T[], start: number, deleteCount: number, ...items: T[]) => T[])
  ),

  unshift: standaloneAction(`${namespace}::unshift`, <T>(array: T[], ...items: T[]): number => {
    return array.unshift(...items)
  }),

  create: <T>(data: T[]): T[] => toTreeNode(data),
}
