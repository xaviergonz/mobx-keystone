import { rootRef, typeCheck, types } from "../../../src"

test("types.ref checks the specified reference constructor", () => {
  const first = rootRef("review/firstRef")
  const second = rootRef("review/secondRef")
  const type = types.ref(first)
  expect(typeCheck(type, first("id"))).toBeNull()
  expect(typeCheck(type, second("id"))).not.toBeNull()
})
