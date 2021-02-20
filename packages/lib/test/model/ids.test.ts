import {
  fromSnapshot,
  getSnapshot,
  idProp,
  model,
  Model,
  runUnprotected,
  SnapshotOutOf,
} from "../../src"
import "../commonSetup"

test("ids", () => {
  @model("ids")
  class M extends Model({}) {}

  // auto generated id
  {
    const m1 = new M({})
    expect(m1.$modelId).toBe("id-1")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids",
    } as SnapshotOutOf<M>)
  }

  // provided id
  {
    const m1 = new M({ $modelId: "MY_ID" })
    expect(m1.$modelId).toBe("MY_ID")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids",
    } as SnapshotOutOf<M>)
  }

  // id on snapshot
  {
    const m1 = fromSnapshot<M>({ $modelType: "ids", $modelId: "MY_ID2" })
    expect(m1.$modelId).toBe("MY_ID2")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids",
    } as SnapshotOutOf<M>)

    const m2 = fromSnapshot<M>(getSnapshot(m1))
    expect(m2.$modelId).toBe("MY_ID2")
    expect(m2.getRefId()).toBe(m2.$modelId)
    expect(getSnapshot(m2)).toEqual({
      $modelId: m2.$modelId,
      $modelType: "ids",
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
      $modelType: "ids",
    } as SnapshotOutOf<M>)

    runUnprotected(() => {
      m1.$modelId = "MY_ID"
    })
    expect(m1.$modelId).toBe("MY_ID")
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(m1.$.$modelId).toBe("MY_ID")
    expect(getSnapshot(m1)).toEqual({
      $modelId: m1.$modelId,
      $modelType: "ids",
    } as SnapshotOutOf<M>)
  }
})

test("ids with custom property", () => {
  @model("ids-customProperty")
  class M extends Model({
    id: idProp,
  }) {}

  // auto generated id
  {
    const m1 = new M({})
    expect(m1.$modelId).toBe("id-1")
    expect(m1.id).toBe(m1.$modelId)
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      id: m1.$modelId,
      $modelType: "ids-customProperty",
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
      $modelType: "ids-customProperty",
    } as SnapshotOutOf<M>)
  }

  // id on snapshot
  {
    const m1 = fromSnapshot<M>({ $modelType: "ids-customProperty", id: "MY_ID2" })
    expect(m1.$modelId).toBe("MY_ID2")
    expect(m1.id).toBe(m1.$modelId)
    expect(m1.getRefId()).toBe(m1.$modelId)
    expect(getSnapshot(m1)).toEqual({
      id: m1.$modelId,
      $modelType: "ids-customProperty",
    } as SnapshotOutOf<M>)

    const m2 = fromSnapshot<M>(getSnapshot(m1))
    expect(m2.$modelId).toBe("MY_ID2")
    expect(m2.id).toBe(m2.$modelId)
    expect(m2.getRefId()).toBe(m2.$modelId)
    expect(getSnapshot(m2)).toEqual({
      id: m2.$modelId,
      $modelType: "ids-customProperty",
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
      $modelType: "ids-customProperty",
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
      $modelType: "ids-customProperty",
    } as SnapshotOutOf<M>)
  }
})
