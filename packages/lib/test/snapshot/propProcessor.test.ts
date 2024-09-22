import { toJS } from "mobx"
import { assert, _ } from "spec.ts"
import {
  applyPatches,
  applySnapshot,
  fromSnapshot,
  getSnapshot,
  Model,
  modelAction,
  modelSnapshotInWithMetadata,
  modelSnapshotOutWithMetadata,
  modelTypeKey,
  prop,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"
import { testModel } from "../utils"

test("input snapshot processor", () => {
  @testModel("customInputSnapshot")
  class P3 extends Model({
    arr: prop<number[]>(() => []).withSnapshotProcessor({
      fromSnapshot: (sn: string) => sn.split(",").map((x) => +x),
    }),
  }) {}

  assert(
    _ as SnapshotInOf<P3>,
    _ as {
      arr: string
    } & {
      [modelTypeKey]?: string
    }
  )

  assert(
    _ as SnapshotOutOf<P3>,
    _ as {
      arr: number[]
    } & {
      [modelTypeKey]?: string
    }
  )

  const p2 = new P3({
    arr: [30, 40, 50],
  })

  expect(toJS(p2.arr)).toEqual([30, 40, 50])

  const p = fromSnapshot<P3>(
    modelSnapshotInWithMetadata(P3, {
      arr: "30,40,50",
    })
  )

  expect(toJS(p.arr)).toEqual([30, 40, 50])

  applyPatches(p, [
    {
      path: ["arr"],
      op: "replace",
      value: [10, 20],
    },
  ])

  expect(toJS(p.arr)).toEqual([10, 20])

  applySnapshot(
    p,
    modelSnapshotInWithMetadata(P3, {
      arr: "100,200",
    })
  )

  expect(toJS(p.arr)).toEqual([100, 200])

  applySnapshot(p.arr, [300, 400])

  expect(toJS(p.arr)).toEqual([300, 400])
})

test("output snapshot processor", () => {
  @testModel("innerCustomOutputSnapshot")
  class IP4 extends Model({
    arr: prop<number[]>(() => []).withSnapshotProcessor({
      toSnapshot: (sn) => {
        return sn.map((x) => String(x)).join(",")
      },
    }),
  }) {
    @modelAction
    pop() {
      this.arr.pop()
    }
  }

  @testModel("customOutputSnapshot")
  class P4 extends Model({
    arr: prop<number[]>(() => []).withSnapshotProcessor({
      toSnapshot: (sn) => {
        return sn.map((x) => String(x)).join(",")
      },
    }),
    child: prop<IP4 | undefined>(),
  }) {
    @modelAction
    pop() {
      this.arr.pop()
    }
  }

  assert(
    _ as SnapshotInOf<P4>,
    _ as {
      arr?: number[] | null
      child?: SnapshotInOf<IP4>
    } & {
      [modelTypeKey]?: string
    }
  )

  assert(
    _ as SnapshotOutOf<P4>,
    _ as {
      arr: string
      child: SnapshotOutOf<IP4> | undefined
    } & {
      [modelTypeKey]?: string
    }
  )

  const p = new P4({
    arr: [30, 40, 50],
    child: new IP4({
      arr: [1, 2, 3],
    }),
  })

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      arr: "30,40,50",
      child: modelSnapshotOutWithMetadata(IP4, {
        arr: "1,2,3",
      }),
    })
  )

  p.pop()
  p.child!.pop()

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      arr: "30,40",
      child: modelSnapshotOutWithMetadata(IP4, {
        arr: "1,2",
      }),
    })
  )

  applyPatches(p, [
    {
      path: ["arr", 0],
      op: "replace",
      value: 10,
    },
  ])

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      arr: "10,40",
      child: modelSnapshotOutWithMetadata(IP4, {
        arr: "1,2",
      }),
    })
  )

  applySnapshot(p, {
    [modelTypeKey]: "output snapshot processor/customOutputSnapshot",
    arr: [100, 200],
    child: {
      [modelTypeKey]: "output snapshot processor/innerCustomOutputSnapshot",
      arr: [300, 400],
    },
  })

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      arr: "100,200",
      child: modelSnapshotOutWithMetadata(IP4, {
        arr: "300,400",
      }),
    })
  )
})

test("model without model type", () => {
  @testModel("m1")
  class M1 extends Model({
    x: prop<number>(),
  }) {}

  @testModel("m2")
  class M2 extends Model({
    m1: prop<M1 | undefined>().withSnapshotProcessor({
      fromSnapshot(sn: Omit<SnapshotInOf<M1>, typeof modelTypeKey>) {
        return { ...sn, [modelTypeKey]: "model without model type/m1" }
      },
      toSnapshot(sn): Omit<SnapshotOutOf<M1>, typeof modelTypeKey> | undefined {
        if (!sn) {
          return sn
        }

        const snCopy = { ...sn }
        delete (snCopy as any)[modelTypeKey]
        return snCopy
      },
    }),
  }) {}

  const m2 = fromSnapshot<M2>(
    modelSnapshotInWithMetadata(M2, {
      m1: { x: 6 }, // no model type!
    })
  )

  expect(m2.m1 instanceof M1).toBe(true)
  expect(m2.m1!.x).toBe(6)

  expect(getSnapshot(m2)).toStrictEqual(
    modelSnapshotOutWithMetadata(M2, {
      m1: { x: 6 }, // no model type!
    })
  )

  expect(getSnapshot(m2.m1)).toStrictEqual(
    modelSnapshotOutWithMetadata(M1, {
      x: 6,
    })
  )
})
