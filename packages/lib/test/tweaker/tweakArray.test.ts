import { configure, getConfig, runUnprotected, tweak } from "../../src"

describe("tweak", () => {
  test("array disallows undefined element when allowArrayElementUndefined is false", () => {
    expect(getConfig().allowArrayElementUndefined).toBeFalsy()

    const array = tweak<undefined[]>([], undefined)

    expect(() => {
      runUnprotected(() => {
        array.push(undefined)
      })
    }).toThrowError(/^undefined is not supported inside arrays/)
  })

  test("array allows undefined element when allowArrayElementUndefined is true", () => {
    configure({ allowArrayElementUndefined: true })

    const array = tweak<undefined[]>([], undefined)

    expect(() => {
      runUnprotected(() => {
        array.push(undefined)
      })
    }).not.toThrowError(/^undefined is not supported inside arrays/)
  })
})
