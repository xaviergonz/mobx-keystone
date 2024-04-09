import { remove } from "mobx"
import { toTreeNode } from "../tweaker/tweak"
import { namespace as ns } from "../utils"
import { setIfDifferent } from "../utils/setIfDifferent"
import { standaloneAction } from "./standaloneActions"

function _splice(array: any[], start: number, deleteCount?: number, ...items: any[]): any[]
function _splice(array: any[], ...args: any[]): any[] {
  return (array.splice as (...args: any[]) => any[])(...args)
}

const namespace = `${ns}/arrayActions`

export const arrayActions = {
  set: standaloneAction(`${namespace}::set`, <T>(array: T[], index: number, value: any): void => {
    setIfDifferent(array, index, value)
  }),

  delete: standaloneAction(`${namespace}::delete`, <T>(array: T[], index: number): boolean => {
    return remove(array, String(index))
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

  swap: standaloneAction(
    `${namespace}::swap`,
    <T>(array: T[], index1: number, index2: number): boolean => {
      if (index1 < 0 || index2 < 0 || index1 >= array.length || index2 >= array.length) {
        return false
      }
      if (index2 < index1) {
        ;[index1, index2] = [index2, index1]
      }
      // since a same node cannot be in two places at once we will remove
      // both then reinsert them
      const [v1] = array.splice(index1, 1)
      const [v2] = array.splice(index2 - 1, 1)
      array.splice(index1, 0, v2)
      array.splice(index2, 0, v1)
      return true
    }
  ),

  create: <T>(data: T[]): T[] => toTreeNode(data),
}
