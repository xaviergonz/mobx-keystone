import { clone, getRootPath, getSnapshot } from "../../src"
import "../commonSetup"
import { createP } from "../testbed"

test("clone", () => {
  const p = createP()

  const cloneP = clone(p)

  const origSn = getSnapshot(p)
  const cloneSn = getSnapshot(cloneP)

  expect(getRootPath(p.p2!).root).toBe(p)
  expect(getRootPath(cloneP.p2!).root).toBe(cloneP)
  expect(p).not.toBe(cloneP)
  expect(p.p2).not.toBe(cloneP.p2)

  expect(origSn).toStrictEqual(cloneSn)
})
