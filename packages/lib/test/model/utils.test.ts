import { getSnapshot, getSnapshotModelId, idProp, Model, tProp, types } from "../../src"
import { testModel } from "../utils"

describe("getSnapshotModelId", () => {
  test("returns undefined for non-model snapshots", () => {
    expect(getSnapshotModelId(null)).toBeUndefined()
    expect(getSnapshotModelId(undefined)).toBeUndefined()
    expect(getSnapshotModelId({})).toBeUndefined()
    expect(getSnapshotModelId({ foo: "bar" })).toBeUndefined()
    expect(getSnapshotModelId([])).toBeUndefined()
  })

  test("returns undefined for unknown model types", () => {
    expect(
      getSnapshotModelId({
        $modelType: "UnknownModelType",
        id: "1",
      })
    ).toBeUndefined()
  })

  test("returns undefined for models without id property", () => {
    @testModel("getSnapshotModelId/NoIdModel")
    class NoIdModel extends Model({
      value: tProp(types.string),
    }) {}

    const m = new NoIdModel({ value: "test" })
    const sn = getSnapshot(m)
    expect(getSnapshotModelId(sn)).toBeUndefined()
  })

  test("returns id for models with default id property", () => {
    @testModel("getSnapshotModelId/DefaultIdModel")
    class DefaultIdModel extends Model({
      id: idProp,
      value: tProp(types.string),
    }) {}

    const m = new DefaultIdModel({ value: "test" })
    const sn = getSnapshot(m)
    expect(getSnapshotModelId(sn)).toBe(m.id)
  })

  test("returns id for models with custom id property", () => {
    @testModel("getSnapshotModelId/CustomIdModel")
    class CustomIdModel extends Model({
      myId: idProp,
      value: tProp(types.string),
    }) {}

    const m = new CustomIdModel({ value: "test" })
    const sn = getSnapshot(m)
    expect(getSnapshotModelId(sn)).toBe(m.myId)
  })

  test("returns undefined if id property is missing in snapshot (e.g. partial snapshot)", () => {
    @testModel("getSnapshotModelId/MissingIdInSnapshot")
    // biome-ignore lint/correctness/noUnusedVariables: we need to register the model
    class MissingIdInSnapshot extends Model({
      id: idProp,
    }) {}

    MissingIdInSnapshot // to avoid unused variable lint error

    // Manually create a partial snapshot that looks like a model snapshot but misses the ID
    const sn = {
      $modelType: "getSnapshotModelId/MissingIdInSnapshot",
    }
    expect(getSnapshotModelId(sn)).toBeUndefined()
  })
})
