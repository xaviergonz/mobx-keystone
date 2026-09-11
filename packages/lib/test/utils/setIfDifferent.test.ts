import { getSnapshot, objectActions } from "../../src"

test("signed zero is a single value for object setters", () => {
  const object = objectActions.create({ value: 0 })
  objectActions.set(object, "value", -0)
  expect(object.value).toBe(0)
  expect(getSnapshot(object).value).toBe(0)
  objectActions.assign(object, { value: -0 })
  expect(object.value).toBe(0)
})

test("setting NaN over NaN is a no-op", () => {
  const object = objectActions.create({ value: Number.NaN })
  const before = getSnapshot(object)
  objectActions.set(object, "value", Number.NaN)
  expect(getSnapshot(object)).toBe(before)
})
