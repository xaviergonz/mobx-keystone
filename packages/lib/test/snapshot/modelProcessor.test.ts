import { assert, _ } from "spec.ts"
import { O } from "ts-toolbelt"
import {
  applyPatches,
  applySnapshot,
  fromSnapshot,
  FromSnapshotDefaultType,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelTypeKey,
  prop,
  setGlobalConfig,
  SnapshotInOf,
  SnapshotOutOf,
  tProp,
  types,
  TypeToData,
} from "../../src"
import "../commonSetup"

type Empty = O.Omit<{}, "">

beforeEach(() => {
  setGlobalConfig({
    avoidModelTypeInTypedModelSnapshotsIfPossible: true,
  })
})

test("input snapshot processor", () => {
  @model("customInputSnapshot")
  class P3 extends Model({
    arr: prop<number[]>(() => []),
  }) {}

  const snp3 = types.snapshotProcessor(types.model(P3), {
    fromSnapshot(sn: { y: string }) {
      return {
        arr: sn.y.split(",").map((x) => +x),
      }
    },
  })

  type SNP3 = TypeToData<typeof snp3>

  assert(
    _ as SnapshotInOf<SNP3>,
    _ as {
      y: string
    }
  )

  assert(
    _ as SnapshotOutOf<SNP3>,
    _ as {
      arr: number[]
    } & {
      [modelTypeKey]?: string
    }
  )

  const p = fromSnapshot(snp3, {
    y: "30,40,50",
  })
  expect(p.arr).toEqual([30, 40, 50])

  applyPatches(p, [
    {
      path: ["arr"],
      op: "replace",
      value: [10, 20],
    },
  ])

  expect(p.arr).toEqual([10, 20])

  applySnapshot(p, {
    arr: [100, 200],
  })

  expect(p.arr).toEqual([100, 200])

  applySnapshot(p.arr, [300, 400])

  expect(p.arr).toEqual([300, 400])
})

test("input snapshot processor with original type", () => {
  const props = {
    arr: prop<number[]>(() => []),
  }

  @model("customInputSnapshotWithOriginalType")
  class P3 extends Model(props) {}

  const snp3 = types.snapshotProcessor(types.model(P3), {
    fromSnapshot(sn: FromSnapshotDefaultType<typeof props> | { arr: string[] }) {
      return {
        arr: sn.arr?.map((x) => +x),
      }
    },
  })

  type SNP3 = TypeToData<typeof snp3>

  assert(
    _ as SnapshotInOf<SNP3>,
    _ as
      | ({
          arr?: number[] | null | undefined
        } & Empty)
      | {
          arr: string[]
        }
  )

  assert(
    _ as SnapshotOutOf<SNP3>,
    _ as {
      arr: number[]
    } & {
      [modelTypeKey]?: string
    }
  )

  const p = fromSnapshot(snp3, {
    arr: ["30", "40", "50"],
  })

  expect(p.arr).toEqual([30, 40, 50])

  applyPatches(p, [
    {
      path: ["arr"],
      op: "replace",
      value: [10, 20],
    },
  ])

  expect(p.arr).toEqual([10, 20])

  applySnapshot(p, {
    arr: [100, 200],
  })

  expect(p.arr).toEqual([100, 200])

  applySnapshot(p.arr, [300, 400])

  expect(p.arr).toEqual([300, 400])
})

test("output snapshot processor", () => {
  @model("innerCustomOutputSnapshot")
  class IP4 extends Model({
    arr: prop<number[]>(() => []),
  }) {
    @modelAction
    pop() {
      this.arr.pop()
    }
  }

  const snip4 = types.snapshotProcessor(types.model(IP4), {
    toSnapshot(sn) {
      return {
        y: sn.arr.map((x) => "" + x).join(","),
      }
    },
  })

  type SNIP4 = TypeToData<typeof snip4>

  @model("customOutputSnapshot")
  class P4 extends Model({
    arr: prop<number[]>(() => []),
    child: tProp(types.maybe(snip4)),
  }) {
    @modelAction
    pop() {
      this.arr.pop()
    }
  }

  const snp4 = types.snapshotProcessor(types.model(P4), {
    toSnapshot(sn) {
      return {
        y: sn.arr.map((x) => "" + x).join(","),
        child: sn.child,
      }
    },
  })

  type SNP4 = TypeToData<typeof snp4>

  assert(
    _ as SnapshotInOf<SNP4>,
    _ as {
      arr?: number[] | null
      child?: SnapshotInOf<IP4>
    } & O.Omit<
      {
        arr: number[] | null | undefined
        child: SnapshotInOf<IP4> | undefined
      },
      "arr" | "child"
    > & {
        [modelTypeKey]?: string
      }
  )

  assert(
    _ as SnapshotOutOf<SNP4>,
    _ as {
      y: string
      child: SnapshotOutOf<SNIP4 | undefined>
    }
  )

  const p = new P4({
    arr: [30, 40, 50],
    child: new IP4({
      arr: [1, 2, 3],
    }),
  })

  expect(getSnapshot(snp4, p)).toEqual({
    y: "30,40,50",
    child: {
      y: "1,2,3",
    },
  })

  p.pop()
  p.child!.pop()

  expect(getSnapshot(snp4, p)).toEqual({
    y: "30,40",
    child: {
      y: "1,2",
    },
  })

  applyPatches(p, [
    {
      path: ["arr", 0],
      op: "replace",
      value: 10,
    },
  ])

  expect(getSnapshot(snp4, p)).toEqual({
    y: "10,40",
    child: {
      y: "1,2",
    },
  })

  applySnapshot(p, {
    [modelTypeKey]: "customOutputSnapshot",
    arr: [100, 200],
    child: {
      [modelTypeKey]: "innerCustomOutputSnapshot",
      arr: [300, 400],
    },
  })

  expect(getSnapshot(snp4, p)).toEqual({
    y: "100,200",
    child: {
      y: "300,400",
    },
  })
})
