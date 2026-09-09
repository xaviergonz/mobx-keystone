import { remove, set } from "mobx"
import {
  getSnapshot,
  Model,
  runUnprotected,
  TypeCheckErrorFailure,
  tProp,
  types,
} from "mobx-keystone"
import * as Y from "yjs"
import { bindYjsToMobxKeystone } from "../../src"
import { autoDispose, testModel } from "../utils"

test("rejected local edits do not compete with concurrent native replacements", () => {
  @testModel("rejected-local-array-update")
  class Root extends Model({
    values: tProp(
      types.refinement(types.array(types.number), (values) => values.every((value) => value >= 0)),
      () => [1]
    ),
    flag: tProp(0),
  }) {}
  const doc = new Y.Doc()
  doc.clientID = 2
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const remote = new Y.Doc()
  remote.clientID = 1
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
  expect(() =>
    runUnprotected(() => {
      binding.boundObject.values[0] = -1
    })
  ).toThrow(TypeCheckErrorFailure)
  expect(binding.boundObject.values.slice()).toEqual([1])
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  const values = remote.getMap("root").get("values") as Y.Array<number>
  remote.transact(() => {
    values.delete(0, 1)
    values.insert(0, [9])
  })
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote))
  expect(binding.boundObject.values.slice()).toEqual([9])
  expect(binding.boundObject.flag).toBe(1)
})

@testModel("rejected-local-changes")
class Root extends Model({
  values: tProp(
    types.refinement(types.array(types.number), (values) => values.length === 1 && values[0] >= 0),
    () => [1]
  ),
  record: tProp(
    types.refinement(
      types.record(types.number),
      (value) => value.extra === undefined && value.count >= 0
    ),
    () => ({ count: 1 })
  ),
  flag: tProp(0),
}) {}

test.each([
  [
    "array update",
    (root: Root) => {
      root.values[0] = -1
    },
  ],
  [
    "array splice",
    (root: Root) => {
      root.values.push(2)
    },
  ],
  [
    "object update",
    (root: Root) => {
      root.record.count = -1
    },
  ],
  [
    "object add",
    (root: Root) => {
      set(root.record, "extra", 2)
    },
  ],
  [
    "object remove",
    (root: Root) => {
      remove(root.record, "count")
    },
  ],
] as const)("rejected %s does not write native operations", (_, mutate) => {
  const doc = new Y.Doc()
  const root = doc.getMap("root")
  const binding = bindYjsToMobxKeystone({ yjsDoc: doc, yjsObject: root, mobxKeystoneType: Root })
  autoDispose(binding.dispose)
  const before = Y.encodeStateVector(doc)
  expect(() => runUnprotected(() => mutate(binding.boundObject))).toThrow(TypeCheckErrorFailure)
  expect(Y.encodeStateVector(doc)).toEqual(before)
  runUnprotected(() => {
    binding.boundObject.flag = 1
  })
  expect(binding.boundObject.values.slice()).toEqual([1])
  expect(getSnapshot(binding.boundObject.record)).toEqual({ count: 1 })
  expect(root.toJSON()).toEqual(getSnapshot(binding.boundObject))
})
