import { clone, getRootPath, getSnapshot } from "../../src"
import "../commonSetup"
import { createP } from "../testbed"

test("clone", () => {
  const p = createP()

  const cloneP = clone(p)

  let origSn = getSnapshot(p)
  let cloneSn = getSnapshot(cloneP)

  expect(getRootPath(p.p2!).root).toBe(p)
  expect(getRootPath(cloneP.p2!).root).toBe(cloneP)
  expect(p).not.toBe(cloneP)
  expect(p.p2).not.toBe(cloneP.p2)

  // ids must have changed
  expect(origSn.$modelId).not.toBe(cloneSn.$modelId)
  expect(origSn.p2!.$modelId).not.toBe(cloneSn.p2!.$modelId)

  // except for ids, everything else should be the same
  origSn = {
    ...origSn,
    $modelId: "p",
    p2: {
      ...origSn.p2!,
      $modelId: "p2",
    },
  }
  cloneSn = {
    ...cloneSn,
    $modelId: "p",
    p2: {
      ...cloneSn.p2!,
      $modelId: "p2",
    },
  }

  expect(origSn).toStrictEqual(cloneSn)
})
