import { fromSnapshot, model, Model, modelSnapshotWithMetadata } from "../../src"
import "../commonSetup"

@model("P3")
export class P3 extends Model<{ arr: number[] }> {
  defaultData = {
    arr: [],
  }

  fromSnapshot(sn: { y: string }) {
    return {
      arr: sn.y.split(",").map(x => +x),
    }
  }
}

test("snapshot processor", () => {
  const p = fromSnapshot<P3>(
    modelSnapshotWithMetadata(
      P3,
      {
        y: "30,40,50",
      },
      "P3-id"
    )
  )

  expect(p.data.arr).toStrictEqual([30, 40, 50])
  expect(p.modelId).toBe("P3-id")
})
