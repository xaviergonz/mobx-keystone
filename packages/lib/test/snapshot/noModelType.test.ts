import {
  AnyDataModel,
  AnyModel,
  AnyStandardType,
  fromSnapshot,
  getSnapshot,
  Model,
  ModelClass,
  modelIdKey,
  modelSnapshotInWithMetadata,
  modelSnapshotOutWithMetadata,
  prop,
  SnapshotInOf,
  tProp,
  types,
  TypeToData,
} from "../../src"
import { testModel } from "../utils"

test("model without model type thanks to a tProp", () => {
  @testModel("M1")
  class M1 extends Model({
    x: prop<number>(),
  }) {}

  @testModel("M2")
  class M2 extends Model({
    m1: tProp(types.model(M1)),
  }) {}

  const m2 = fromSnapshot(
    M2,
    modelSnapshotInWithMetadata(M2, {
      m1: { x: 6 }, // no model type!
    })
  )

  expect(m2.m1 instanceof M1).toBe(true)
  expect(m2.m1.x).toBe(6)

  expect(getSnapshot(m2)).toStrictEqual(
    modelSnapshotOutWithMetadata(M2, {
      m1: modelSnapshotOutWithMetadata(M1, { x: 6 }),
    })
  )

  expect(getSnapshot(m2.m1)).toStrictEqual(
    modelSnapshotOutWithMetadata(M1, {
      x: 6,
    })
  )

  // getSnapshot with a type

  const sn2 = getSnapshot(types.model(M2), m2)
  // multiple calls should yield the same result
  expect(getSnapshot(types.model(M2), m2)).toBe(sn2)

  expect(sn2).toStrictEqual(
    modelSnapshotOutWithMetadata(M2, {
      m1: modelSnapshotOutWithMetadata(M1, {
        x: 6,
      }),
    })
  )

  const sn1 = getSnapshot(types.model(M1), m2.m1)
  // multiple calls should yield the same result
  expect(getSnapshot(types.model(M1), m2.m1)).toBe(sn1)

  expect(sn1).toStrictEqual(
    modelSnapshotOutWithMetadata(M1, {
      x: 6,
    })
  )
})

test("model without model type thanks to a type passed to fromSnapshot", () => {
  @testModel("M1")
  class M1 extends Model({
    x: tProp(types.number),
  }) {}

  const m1Sn: SnapshotInOf<M1> = { x: 1 }

  @testModel("M2")
  class M2 extends Model({
    y: tProp(types.number),
  }) {}

  // const m2Sn: SnapshotInOf<M2> = { y: 1 }

  const testType = <
    TType extends AnyStandardType | ModelClass<AnyModel> | ModelClass<AnyDataModel>,
  >(
    type: TType,
    sn: SnapshotInOf<TypeToData<TType>>,
    getInstance?: (val: TypeToData<TType>) => M1 | M2 | undefined | null
  ) => {
    const fsn = fromSnapshot(type, sn)

    const m1 = getInstance?.(fsn)
    if (m1 !== undefined) {
      expect(m1 instanceof M1).toBe(true)
      expect((m1 as M1).x).toBe(m1Sn.x)
      expect(getSnapshot(m1)).toStrictEqual(modelSnapshotOutWithMetadata(M1, m1Sn))
      // TODO: do we need a getSnapshot that will skip modelType?
    } else {
      expect(getSnapshot(fsn)).toStrictEqual(sn)
    }
  }

  testType(types.model(M1), m1Sn, (v) => v)

  testType(types.maybe(types.model(M1)), undefined)
  testType(types.maybe(types.model(M1)), m1Sn, (v) => v)

  testType(types.maybeNull(types.model(M1)), null)
  testType(types.maybeNull(types.model(M1)), m1Sn, (v) => v)

  testType(types.array(types.model(M1)), [m1Sn], (v) => v[0])

  testType(
    types.arraySet(types.model(M1)),
    { [modelIdKey]: "1", items: [m1Sn] },
    (v) => [...v.values()][0]
  )

  testType(
    types.object(() => ({
      a: types.model(M1),
      b: types.number,
    })),
    { a: m1Sn, b: 1 },
    (v) => v.a
  )

  testType(types.objectMap(types.model(M1)), { [modelIdKey]: "1", items: { a: m1Sn } }, (v) =>
    v.get("a")
  )

  testType(types.or(types.model(M2), types.model(M1)), m1Sn, (v) => v)

  testType(
    types.or(
      (sn) => {
        return typeof sn.x === "number" ? types.model(M1) : types.model(M2)
      },
      types.model(M2),
      types.model(M1)
    ),
    m1Sn,
    (v) => v
  )

  testType(
    types.record(types.model(M1)),
    {
      a: m1Sn,
    },
    (v) => v.a
  )

  testType(types.tuple(types.model(M1)), [m1Sn], (v) => v[0])
})
