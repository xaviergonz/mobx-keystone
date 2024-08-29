import { getGlobalConfig, runUnprotected, setGlobalConfig, toTreeNode } from "../../src"

test("array disallows undefined element when allowUndefinedArrayElements is false", () => {
  expect(getGlobalConfig().allowUndefinedArrayElements).toBeFalsy()

  const array = toTreeNode<undefined[]>([])

  expect(() => {
    runUnprotected(() => {
      array.push(undefined)
    })
  }).toThrow(/^undefined is not supported inside arrays/)
})

test("array allows undefined element when allowUndefinedArrayElements is true", () => {
  setGlobalConfig({ allowUndefinedArrayElements: true })

  const array = toTreeNode<undefined[]>([])

  expect(() => {
    runUnprotected(() => {
      array.push(undefined)
    })
  }).not.toThrow(/^undefined is not supported inside arrays/)
})
