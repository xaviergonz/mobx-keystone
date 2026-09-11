import { ImmutableDate } from "../../src/transforms/ImmutableDate"

test("legacy setYear cannot mutate an immutable date", () => {
  const date = new ImmutableDate(0)
  const setYear = Reflect.get(date, "setYear") as (year: number) => number
  expect(() => setYear.call(date, 2000)).toThrow("this Date object is immutable")
  expect(date.getTime()).toBe(0)
})
