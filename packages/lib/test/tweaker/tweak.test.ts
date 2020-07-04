import { getGlobalConfig, runUnprotected, setGlobalConfig, tweak } from "../../src"

describe("tweak", () => {
  test("array disallows undefined element when allowUndefinedArrayElements is false", () => {
    expect(getGlobalConfig().allowUndefinedArrayElements).toBeFalsy()

    const array = tweak<undefined[]>([], undefined)

    expect(() => {
      runUnprotected(() => {
        array.push(undefined)
      })
    }).toThrowError(/^undefined is not supported inside arrays/)
  })

  test("array allows undefined element when allowUndefinedArrayElements is true", () => {
    setGlobalConfig({ allowUndefinedArrayElements: true })

    const array = tweak<undefined[]>([], undefined)

    expect(() => {
      runUnprotected(() => {
        array.push(undefined)
      })
    }).not.toThrowError(/^undefined is not supported inside arrays/)
  })
})
