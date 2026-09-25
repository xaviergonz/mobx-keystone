import { expectTypeOf } from "expect-type"
import {
  type AnyType,
  type Frozen,
  fromSnapshot,
  getSnapshot,
  idProp,
  Model,
  type ModelCreationData,
  type ModelData,
  prop,
  type SnapshotInOf,
  type SnapshotOutOf,
  type TypedOptionalModelProp,
  type TypeToData,
  type TypeToSnapshotIn,
  type TypeToSnapshotOut,
  tProp,
  types,
} from "../../src"
import type { TypeToStoredData } from "../../src/types/utility/typeToStoredData"
import { testModel } from "../utils"

// these tests pin down the shape of the recursive type mappings, which are written
// to keep the number of type instantiations low

test("object type schemas make keys optional only when their data accepts undefined", () => {
  const objType = types.object(() => ({
    req: types.string,
    maybe: types.maybe(types.number),
    maybeNull: types.maybeNull(types.string),
    unknownValue: types.unchecked<unknown>(),
    anyValue: types.unchecked<any>(),
    nested: types.object(() => ({ x: types.maybe(types.boolean) })),
  }))

  type Expected = {
    req: string
    maybe?: number | undefined
    maybeNull: string | null
    unknownValue?: unknown
    anyValue?: any
    nested: { x?: boolean | undefined }
  }

  expectTypeOf<TypeToData<typeof objType>>().toEqualTypeOf<Expected>()
  expectTypeOf<TypeToSnapshotIn<typeof objType>>().toEqualTypeOf<Expected>()
  expectTypeOf<TypeToSnapshotOut<typeof objType>>().toEqualTypeOf<Expected>()
  expectTypeOf<TypeToStoredData<typeof objType>>().toEqualTypeOf<Expected>()
})

test("codec, array, tuple and record schemas map each representation", () => {
  const objType = types.object(() => ({
    date: types.dateAsTimestamp,
    maybeDate: types.maybe(types.dateAsTimestamp),
    arr: types.array(types.dateAsTimestamp),
    tuple: types.tuple(types.string, types.dateAsTimestamp),
    rec: types.record(types.dateAsTimestamp),
  }))

  expectTypeOf<TypeToData<typeof objType>>().toEqualTypeOf<{
    date: Date
    maybeDate?: Date | undefined
    arr: Date[]
    tuple: [string, Date]
    rec: { [k: string]: Date }
  }>()

  type Encoded = {
    date: number
    maybeDate?: number | undefined
    arr: number[]
    tuple: [string, number]
    rec: { [k: string]: number }
  }
  expectTypeOf<TypeToSnapshotIn<typeof objType>>().toEqualTypeOf<Encoded>()
  expectTypeOf<TypeToSnapshotOut<typeof objType>>().toEqualTypeOf<Encoded>()
  expectTypeOf<TypeToStoredData<typeof objType>>().toEqualTypeOf<Encoded>()
})

test("snapshots of plain values", () => {
  expectTypeOf<SnapshotOutOf<string>>().toEqualTypeOf<string>()
  expectTypeOf<SnapshotInOf<number | undefined>>().toEqualTypeOf<number | undefined>()
  expectTypeOf<SnapshotOutOf<{ a: string; b?: { c: number[] } | null }>>().toEqualTypeOf<{
    a: string
    b?: { c: number[] } | null
  }>()
  expectTypeOf<SnapshotOutOf<Frozen<{ a: number[] }>>>().toEqualTypeOf<{
    $frozen: true
    data: { a: number[] }
  }>()

  interface Tree {
    value: number
    children: Tree[]
  }
  expectTypeOf<
    SnapshotOutOf<Tree>["children"][number]["children"][number]["value"]
  >().toEqualTypeOf<number>()
  expectTypeOf<SnapshotInOf<Tree>>().toMatchTypeOf<{ value: number; children: unknown[] }>()
})

test("model data, creation data and snapshots", () => {
  const objType = types.object(() => ({
    a: types.string,
    b: types.maybe(types.number),
  }))

  @testModel("typeMappings/Child")
  class Child extends Model({ x: prop(0) }) {}

  @testModel("typeMappings/Parent")
  class Parent extends Model({
    id: idProp,
    req: prop<string>(),
    def: prop(1),
    child: prop<Child | undefined>(),
    children: prop<Child[]>(() => []),
    obj: tProp(objType),
    date: tProp(types.dateAsTimestamp),
    withSetter: prop(0).withSetter(),
  }) {}

  type ObjData = { a: string; b?: number | undefined }

  expectTypeOf<ModelData<Parent>>().toEqualTypeOf<{
    id: string
    req: string
    def: number
    child: Child | undefined
    children: Child[]
    obj: ObjData
    date: Date
    withSetter: number
  }>()

  expectTypeOf<Parent["$"]>().toEqualTypeOf<{
    id: string
    req: string
    def: number
    child: Child | undefined
    children: Child[]
    obj: ObjData
    date: number
    withSetter: number
  }>()

  expectTypeOf<ModelCreationData<Parent>>().toEqualTypeOf<
    {
      id?: string | undefined
      req?: string
      def?: number | null | undefined
      child?: Child | undefined
      children?: Child[] | null | undefined
      obj?: ObjData
      date?: Date
      withSetter?: number | null | undefined
    } & {
      req: string
      obj: ObjData
      date: Date
    }
  >()

  expectTypeOf<SnapshotOutOf<Parent>>().toEqualTypeOf<
    {
      id: string
      req: string
      def: number
      child: SnapshotOutOf<Child> | undefined
      children: SnapshotOutOf<Child>[]
      obj: ObjData
      date: number
      withSetter: number
    } & { $modelType?: string }
  >()

  expectTypeOf<SnapshotInOf<Parent>>().toEqualTypeOf<
    {
      id?: string | undefined
      req: string
      def?: number | null | undefined
      child?: SnapshotInOf<Child> | undefined
      children?: SnapshotInOf<Child>[] | null | undefined
      obj: ObjData
      date: number
      withSetter?: number | null | undefined
    } & { $modelType?: string }
  >()

  expectTypeOf<Parent["setWithSetter"]>().toEqualTypeOf<(value: number) => void>()
})

test("tProp modifiers keep the stored (encoded) types of codecs", () => {
  @testModel("typeMappings/CodecModifiers")
  class M extends Model({
    plain: tProp(types.dateAsTimestamp),
    setter: tProp(types.dateAsTimestamp).withSetter(),
    setterDefault: tProp(types.dateAsTimestamp, () => new Date(0)).withSetter(),
    processor: tProp(types.dateAsTimestamp).withSnapshotProcessor({
      fromSnapshot: (sn: string) => Number(sn),
    }),
    transform: tProp(types.dateAsTimestamp).withTransform<number>({
      transform: ({ originalValue }) => originalValue.getTime() + 1,
      untransform: ({ transformedValue }) => new Date(transformedValue - 1),
    }),
  }) {}

  const m = new M({
    plain: new Date(1),
    setter: new Date(2),
    processor: new Date(3),
    transform: 6,
  })
  m.setSetter(new Date(4))
  expect(m.$).toEqual({ plain: 1, setter: 4, setterDefault: 0, processor: 3, transform: 5 })
  expect(m.transform).toBe(6)

  expectTypeOf<M["$"]>().toEqualTypeOf<{
    plain: number
    setter: number
    setterDefault: number
    processor: number
    transform: number
  }>()

  expectTypeOf<ModelData<M>>().toEqualTypeOf<{
    plain: Date
    setter: Date
    setterDefault: Date
    processor: Date
    transform: number
  }>()

  expectTypeOf<M["setSetter"]>().toEqualTypeOf<(value: Date) => void>()

  expectTypeOf<SnapshotOutOf<M>>().toEqualTypeOf<
    {
      plain: number
      setter: number
      setterDefault: number
      processor: number
      transform: number
    } & { $modelType?: string }
  >()

  expectTypeOf<SnapshotInOf<M>>().toEqualTypeOf<
    {
      plain: number
      setter: number
      setterDefault?: number | null | undefined
      processor: string
      transform: number
    } & { $modelType?: string }
  >()
})

test("data and snapshot arguments are checked against the type argument, not used to infer it", () => {
  const numProp = tProp(types.number, 1)
  expectTypeOf(numProp).toEqualTypeOf<TypedOptionalModelProp<typeof types.number>>()

  // @ts-expect-error wrong default value type
  tProp(types.number, "x")
  // @ts-expect-error wrong default value type
  tProp(types.array(types.number), () => ["x"])

  const objType = types.object(() => ({ a: types.number }))
  expectTypeOf(fromSnapshot(objType, { a: 1 })).toEqualTypeOf<{ a: number }>()
  // @ts-expect-error excess property
  fromSnapshot(objType, { a: 1, b: 2 })
  // @ts-expect-error wrong snapshot type
  fromSnapshot(objType, { a: "x" })

  // output snapshots are accepted as well, since they must always round-trip
  @testModel("typeMappings/RoundTrip")
  class RoundTrip extends Model({ a: prop(0), d: tProp(types.dateAsTimestamp) }) {}
  const rt = new RoundTrip({ d: new Date(5) })
  const rt2 = fromSnapshot(RoundTrip, getSnapshot(rt))
  expectTypeOf(rt2).toEqualTypeOf<RoundTrip>()
  expect(rt2.d.getTime()).toBe(5)
  expectTypeOf(fromSnapshot(types.dateAsTimestamp, 5)).toEqualTypeOf<Date>()

  // generic callers keep working
  const generic = <TType extends AnyType>(type: TType, sn: TypeToSnapshotIn<TType>) =>
    fromSnapshot(type, sn)
  expectTypeOf(generic(objType, { a: 1 })).toEqualTypeOf<{ a: number }>()
})
