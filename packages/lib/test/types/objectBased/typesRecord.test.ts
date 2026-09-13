import { observable } from "mobx"
import { typeCheck, types } from "../../../src"
import { resolveTypeChecker } from "../../../src/types/resolveTypeChecker"

test("record types reject array containers consistently", () => {
  const type = types.record(types.number)
  for (const value of [[], [1, 2], observable.array([1, 2])]) {
    expect(typeCheck(type, value as never)).not.toBeNull()
    expect(resolveTypeChecker(type).snapshotType(value)).toBeNull()
  }
  expect(typeCheck(type, {})).toBeNull()
})
