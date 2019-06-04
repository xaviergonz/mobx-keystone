import { clone, getRootPath, getSnapshot, modelIdKey, ref, runUnprotected } from "../../src"
import "../commonSetup"
import { createP } from "../testbed"

test("clone with same ids", () => {
  const p = createP()
  runUnprotected(() => {
    ;(p.data as any).p2r = ref(p.data.p2!)
  })
  const cloneP = clone(p, { generateNewIds: false })

  const origSn = getSnapshot(p)
  const cloneSn = getSnapshot(cloneP)

  expect(getRootPath(p.data.p2!).root).toBe(p)
  expect(getRootPath(cloneP.data.p2!).root).toBe(cloneP)
  expect(p).not.toBe(cloneP)
  expect(p.data.p2).not.toBe(cloneP.data.p2)

  expect(origSn).toStrictEqual(cloneSn)
})

test("clone with different ids", () => {
  const p = createP()
  runUnprotected(() => {
    ;(p.data as any).p2r = ref(p.data.p2!)
  })
  const cloneP = clone(p, { generateNewIds: true })

  const origSn = getSnapshot(p)
  const cloneSn = getSnapshot(cloneP)

  // clone should generate different ids for models
  expect(p.modelId).not.toBe(cloneP.modelId)
  expect(origSn[modelIdKey]).toBe(p.modelId)
  expect(cloneSn[modelIdKey]).toBe(cloneP.modelId)

  expect(p.data.p2!.modelId).not.toBe(cloneP.data.p2!.modelId)
  expect(origSn.p2![modelIdKey]).toBe(p.data.p2!.modelId)
  expect(cloneSn.p2![modelIdKey]).toBe(cloneP.data.p2!.modelId)

  // ref ids should be auto fixed
  expect((p.data as any).p2r.id).toBe(p.data.p2!.modelId)
  expect((cloneP.data as any).p2r.id).toBe(cloneP.data.p2!.modelId)

  expect(getRootPath(p.data.p2!).root).toBe(p)
  expect(getRootPath(cloneP.data.p2!).root).toBe(cloneP)
  expect(p).not.toBe(cloneP)
  expect(p.data.p2).not.toBe(cloneP.data.p2)
})
