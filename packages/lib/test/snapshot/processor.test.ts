import { assert, _ } from "spec.ts"
import {
  fromSnapshot,
  model,
  Model,
  modelIdKey,
  modelSnapshotInWithMetadata,
  modelTypeKey,
  prop,
  SnapshotInOf,
  SnapshotOutOf,
} from "../../src"
import "../commonSetup"

test("input snapshot processor", () => {
  @model("customInputSnapshot")
  class P3 extends Model({
    arr: prop<number[]>(() => []),
  }) {
    fromSnapshot(sn: { y: string }) {
      return {
        arr: sn.y.split(",").map((x) => +x),
      }
    }
  }

  assert(
    _ as SnapshotInOf<P3>,
    _ as {
      y: string
    } & { [modelTypeKey]: string; [modelIdKey]: string }
  )

  assert(
    _ as SnapshotOutOf<P3>,
    _ as {
      arr: number[]
    } & { [modelTypeKey]: string; [modelIdKey]: string }
  )

  const p = fromSnapshot<P3>(
    modelSnapshotInWithMetadata(P3, {
      y: "30,40,50",
    })
  )

  expect(p.arr).toEqual([30, 40, 50])
})
