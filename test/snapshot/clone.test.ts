import { clone, getRootPath, getSnapshot, modelIdKey } from "../../src"
import { createP } from "../testbed"

test("clone", () => {
  const p = createP()
  const cloneP = clone(p)

  const origSn = getSnapshot(p)
  const cloneSn = getSnapshot(cloneP)

  expect(p.modelId).not.toBe(cloneP.modelId)
  expect(origSn[modelIdKey]).toBe(p.modelId)
  expect(cloneSn[modelIdKey]).toBe(cloneP.modelId)

  expect({ ...origSn, [modelIdKey]: "" }).toStrictEqual({ ...cloneSn, [modelIdKey]: "" })
  expect(getRootPath(p.data.p2!).root).toBe(p)
  expect(getRootPath(cloneP.data.p2!).root).toBe(cloneP)
  expect(p).not.toBe(cloneP)
  expect(p.data.p2).not.toBe(cloneP.data.p2)
})
