import { chainFns } from "../../src/utils/chainFns"

test("empty chains have no function", () => {
  expect(chainFns(undefined, undefined)).toBeUndefined()
})

test("a single function needs no wrapper", () => {
  const fn = (value: number) => value + 1
  expect(chainFns(undefined, fn, undefined)).toBe(fn)
})

test("chains pass results and extra arguments in order", () => {
  const add = (value: number, extra: number) => value + extra
  const multiply = (value: number, extra: number) => value * extra
  expect(chainFns(add, undefined, multiply)!(2, 3)).toBe(15)
})
