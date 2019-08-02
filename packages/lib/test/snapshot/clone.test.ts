import { clone, getRootPath, getSnapshot, modelMetadataKey, ref, runUnprotected } from "../../src"
import "../commonSetup"
import { createP } from "../testbed"

test("clone with same ids", () => {
  const p = createP()
  runUnprotected(() => {
    ;(p.$ as any).p2r = ref(p.$.p2!)
  })
  const cloneP = clone(p, { generateNewIds: false })

  const origSn = getSnapshot(p)
  const cloneSn = getSnapshot(cloneP)

  expect(getRootPath(p.$.p2!).root).toBe(p)
  expect(getRootPath(cloneP.$.p2!).root).toBe(cloneP)
  expect(p).not.toBe(cloneP)
  expect(p.$.p2).not.toBe(cloneP.$.p2)

  expect(origSn).toStrictEqual(cloneSn)
})

test("clone with different ids", () => {
  const p = createP()
  runUnprotected(() => {
    ;(p.$ as any).p2r = ref(p.$.p2!)
  })
  const cloneP = clone(p, { generateNewIds: true })

  const origSn = getSnapshot(p)
  const cloneSn = getSnapshot(cloneP)

  // clone should generate different ids for models
  expect(p.modelId).not.toBe(cloneP.modelId)
  expect(origSn[modelMetadataKey].id).toBe(p.modelId)
  expect(cloneSn[modelMetadataKey].id).toBe(cloneP.modelId)

  expect(p.$.p2!.modelId).not.toBe(cloneP.$.p2!.modelId)
  expect(origSn.p2![modelMetadataKey].id).toBe(p.$.p2!.modelId)
  expect(cloneSn.p2![modelMetadataKey].id).toBe(cloneP.$.p2!.modelId)

  // ref ids should be auto fixed
  expect((p.$ as any).p2r.id).toBe(p.$.p2!.modelId)
  expect((cloneP.$ as any).p2r.id).toBe(cloneP.$.p2!.modelId)

  expect(getRootPath(p.$.p2!).root).toBe(p)
  expect(getRootPath(cloneP.$.p2!).root).toBe(cloneP)
  expect(p).not.toBe(cloneP)
  expect(p.$.p2).not.toBe(cloneP.$.p2)
})
