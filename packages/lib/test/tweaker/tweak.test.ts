import { observable } from "mobx"
import {
  getGlobalConfig,
  getSnapshot,
  runUnprotected,
  setGlobalConfig,
  toTreeNode,
} from "../../src"

const undefinedIsNotSupported = /^undefined is not supported inside arrays/

test("array disallows undefined element when allowUndefinedArrayElements is false", () => {
  expect(getGlobalConfig().allowUndefinedArrayElements).toBeFalsy()

  const array = toTreeNode<undefined[]>([])

  expect(() => {
    runUnprotected(() => {
      array.push(undefined)
    })
  }).toThrow(undefinedIsNotSupported)
})

test("array allows undefined element when allowUndefinedArrayElements is true", () => {
  setGlobalConfig({ allowUndefinedArrayElements: true })

  const array = toTreeNode<undefined[]>([])

  expect(() => {
    runUnprotected(() => {
      array.push(undefined)
    })
  }).not.toThrow(undefinedIsNotSupported)
})

test("observable object values are retained when becoming a tree node", () => {
  const value = observable.object({ count: 1, label: "ready" })

  expect(toTreeNode(value)).toBe(value)
  expect(getSnapshot(value)).toEqual({ count: 1, label: "ready" })
})
