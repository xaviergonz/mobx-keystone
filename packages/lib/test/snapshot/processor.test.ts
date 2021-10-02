import { assert, _ } from "spec.ts"
import {
  applyPatches,
  applySnapshot,
  fromSnapshot,
  getSnapshot,
  model,
  Model,
  modelAction,
  modelSnapshotInWithMetadata,
  modelSnapshotOutWithMetadata,
  modelTypeKey,
  prop,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"
import "../commonSetup"

test("input snapshot processor", () => {
  @model("customInputSnapshot")
  class P3 extends Model(
    {
      arr: prop<number[]>(() => []),
    },
    {
      fromSnapshotProcessor(sn: { y: string }) {
        return {
          arr: sn.y.split(",").map((x) => +x),
        }
      },
    }
  ) {}

  assert(
    _ as SnapshotInOf<P3>,
    _ as {
      y: string
    } & {
      [modelTypeKey]: string
    }
  )

  assert(
    _ as SnapshotOutOf<P3>,
    _ as {
      arr: number[]
    } & {
      [modelTypeKey]: string
    }
  )

  const p = fromSnapshot<P3>(
    modelSnapshotInWithMetadata(P3, {
      y: "30,40,50",
    })
  )

  expect(p.arr).toEqual([30, 40, 50])

  applyPatches(p, [
    {
      path: ["arr"],
      op: "replace",
      value: [10, 20],
    },
  ])

  expect(p.arr).toEqual([10, 20])

  applySnapshot(
    p,
    modelSnapshotInWithMetadata(P3, {
      y: "100,200",
    })
  )

  expect(p.arr).toEqual([100, 200])

  applySnapshot(p.arr, [300, 400])

  expect(p.arr).toEqual([300, 400])
})

test("output snapshot processor", () => {
  @model("innerCustomOutputSnapshot")
  class IP4 extends Model(
    {
      arr: prop<number[]>(() => []),
    },
    {
      toSnapshotProcessor(sn, instance) {
        expect(instance instanceof IP4).toBe(true)
        return {
          y: sn.arr.map((x) => "" + x).join(","),
        }
      },
    }
  ) {
    @modelAction
    pop() {
      this.arr.pop()
    }
  }

  @model("customOutputSnapshot")
  class P4 extends Model(
    {
      arr: prop<number[]>(() => []),
      child: prop<IP4 | undefined>(),
    },
    {
      toSnapshotProcessor(sn, instance) {
        expect(instance instanceof P4).toBe(true)
        return {
          y: sn.arr.map((x) => "" + x).join(","),
          child: sn.child,
        }
      },
    }
  ) {
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
      [modelTypeKey]: string
    }
  )

  assert(
    _ as SnapshotOutOf<P4>,
    _ as {
      y: string
      child: SnapshotOutOf<IP4> | undefined
    } & {
      [modelTypeKey]: string
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
      y: "30,40,50",
      child: modelSnapshotOutWithMetadata(IP4, {
        y: "1,2,3",
      }),
    })
  )

  p.pop()
  p.child!.pop()

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      y: "30,40",
      child: modelSnapshotOutWithMetadata(IP4, {
        y: "1,2",
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
      y: "10,40",
      child: modelSnapshotOutWithMetadata(IP4, {
        y: "1,2",
      }),
    })
  )

  applySnapshot(p, {
    [modelTypeKey]: "customOutputSnapshot",
    arr: [100, 200],
    child: {
      [modelTypeKey]: "innerCustomOutputSnapshot",
      arr: [300, 400],
    },
  })

  expect(getSnapshot(p)).toEqual(
    modelSnapshotOutWithMetadata(P4, {
      y: "100,200",
      child: modelSnapshotOutWithMetadata(IP4, {
        y: "300,400",
      }),
    })
  )
})
