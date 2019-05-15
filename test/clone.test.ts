import { createP } from "./testbed"
import { clone, getSnapshot, getRootPath } from "../src"

test("clone", () => {
  const p = createP()
  const cloneP = clone(p)

  expect(getSnapshot(p)).toStrictEqual(getSnapshot(cloneP))
  expect(getRootPath(p.data.p2!).root).toBe(p)
  expect(getRootPath(cloneP.data.p2!).root).toBe(cloneP)
  expect(p).not.toBe(cloneP)
  expect(p.data.p2).not.toBe(cloneP.data.p2)
})
