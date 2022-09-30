import { assert, _ } from "spec.ts"
import {
  ExtendedModel,
  fromSnapshot,
  getSnapshot,
  idProp,
  Model,
  modelIdKey,
  ModelIdPropertyName,
  runUnprotected,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"
import { testModel } from "../utils"

test("ids", () => {
  @testModel("ids")
  class M extends Model({
    [modelIdKey]: idProp,
  }) {}

  // auto generated id
  {
    const m1 = new M({})
    expect(m1.$modelId).toBe("id-1")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids/ids",
    } as SnapshotOutOf<M>)
  }

  // provided id
  {
    const m1 = new M({ $modelId: "MY_ID" })
    expect(m1.$modelId).toBe("MY_ID")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids/ids",
    } as SnapshotOutOf<M>)
  }

  // id on snapshot
  {
    const m1 = fromSnapshot(M, { $modelType: "ids/ids", $modelId: "MY_ID2" })
    expect(m1.$modelId).toBe("MY_ID2")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids/ids",
    } as SnapshotOutOf<M>)

    const m2 = fromSnapshot(M, getSnapshot(m1))
    expect(m2.$modelId).toBe("MY_ID2")
    expect(m2.getRefId()).toBe(m2.$modelId)
    expect(getSnapshot(m2)).toEqual({
      $modelId: m2.$modelId,
      $modelType: "ids/ids",
    } as SnapshotOutOf<M>)
  }

  // change id on the fly
  {
    const m1 = new M({})
    expect(m1.$modelId).toBe("id-2")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(m1.$.$modelId).toBe("id-2")
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids/ids",
    } as SnapshotOutOf<M>)

    runUnprotected(() => {
      m1.$modelId = "MY_ID"
    })
    expect(m1.$modelId).toBe("MY_ID")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(m1.$.$modelId).toBe("MY_ID")
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids/ids",
    } as SnapshotOutOf<M>)
  }
})

test("ids with custom property", () => {
  @testModel("ids-customProperty")
  class M extends Model({
    id: idProp.withSetter(),
  }) {}

  // auto generated id
  {
    const m1 = new M({})
    expect(m1.$modelId).toBe("id-1")
    expect(m1.id).toBe(m1.$modelId)
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      id: m1.$modelId,
      $modelType: "ids with custom property/ids-customProperty",
    } as SnapshotOutOf<M>)
  }

  // provided id
  {
    const m1 = new M({ id: "MY_ID" })
    expect(m1.$modelId).toBe("MY_ID")
    expect(m1.id).toBe(m1.$modelId)
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      id: m1.$modelId,
      $modelType: "ids with custom property/ids-customProperty",
    } as SnapshotOutOf<M>)
  }

  // id on snapshot
  {
    const m1 = fromSnapshot(M, {
      $modelType: "ids with custom property/ids-customProperty",
      id: "MY_ID2",
    })
    expect(m1.$modelId).toBe("MY_ID2")
    expect(m1.id).toBe(m1.$modelId)
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      id: m1.$modelId,
      $modelType: "ids with custom property/ids-customProperty",
    } as SnapshotOutOf<M>)

    const m2 = fromSnapshot(M, getSnapshot(m1))
    expect(m2.$modelId).toBe("MY_ID2")
    expect(m2.id).toBe(m2.$modelId)
    expect(m2.getRefId()).toBe(m2.$modelId)
    expect(getSnapshot(m2)).toEqual({
      id: m2.$modelId,
      $modelType: "ids with custom property/ids-customProperty",
    } as SnapshotOutOf<M>)
  }

  // change id on the fly
  {
    const m1 = new M({})
    expect(m1.$modelId).toBe("id-2")
    expect(m1.id).toBe(m1.$modelId)
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(m1.$.id).toBe("id-2")
    expect((m1.$ as any).$modelId).toBe(undefined)
    expect(getSnapshot(m1)).toEqual({
      id: m1.$modelId,
      $modelType: "ids with custom property/ids-customProperty",
    } as SnapshotOutOf<M>)

    runUnprotected(() => {
      m1.$modelId = "MY_ID"
    })
    expect(m1.$modelId).toBe("MY_ID")
    expect(m1.id).toBe(m1.$modelId)
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(m1.$.id).toBe("MY_ID")
    expect((m1.$ as any).$modelId).toBe(undefined)
    expect(getSnapshot(m1)).toEqual({
      id: m1.$modelId,
      $modelType: "ids with custom property/ids-customProperty",
    } as SnapshotOutOf<M>)

    m1.setId("MY_ID2")
    expect(m1.$modelId).toBe("MY_ID2")
    expect(m1.id).toBe(m1.$modelId)
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(m1.$.id).toBe("MY_ID2")
    expect((m1.$ as any).$modelId).toBe(undefined)
    expect(getSnapshot(m1)).toEqual({
      id: m1.$modelId,
      $modelType: "ids with custom property/ids-customProperty",
    } as SnapshotOutOf<M>)
  }
})

test("extended class from base with custom id", () => {
  @testModel("IdOnBase")
  class IdOnBase extends Model({
    id: idProp,
  }) {}

  assert(_ as ModelIdPropertyName<IdOnBase>, _ as "id")

  @testModel("ExtendedIdOnBase")
  class ExtendedIdOnBase extends ExtendedModel(IdOnBase, {}) {}

  assert(_ as ModelIdPropertyName<ExtendedIdOnBase>, _ as "id")

  const m1 = new ExtendedIdOnBase({ id: "MY_ID" })
  expect(m1.$modelId).toBe("MY_ID")
  expect(m1.id).toBe(m1.$modelId)
  expect(m1.getRefId()).toBe(m1.$modelId)
  expect(m1.$.id).toBe("MY_ID")
  expect((m1.$ as any).$modelId).toBe(undefined)
})

test("idProp.typedAs", () => {
  type Id = `custom-${string}`
  @testModel("M")
  class M extends Model({
    id: idProp.typedAs<Id>(),
  }) {}

  const m = new M({ id: "custom-1" })
  assert(m.id, _ as Id)
  assert(_ as SnapshotInOf<M>["id"], _ as Id | undefined)
  assert(_ as SnapshotOutOf<M>["id"], _ as Id)
  assert(m.$modelId, _ as Id)
})
