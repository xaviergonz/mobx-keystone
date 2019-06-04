import { fromSnapshot, model, Model, modelIdKey, typeofKey } from "../../src"
import "../commonSetup"

@model("P3")
export class P3 extends Model {
  data: {
    arr: number[]
  } = {
    arr: [],
  }

  fromSnapshot(sn: { y: string }) {
    return {
      arr: sn.y.split(",").map(x => +x),
    }
  }
}

test("snapshot processor", () => {
  const p = fromSnapshot<P3>({
    [typeofKey]: "P3",
    [modelIdKey]: "P3-id",
    y: "30,40,50",
  })

  expect(p.data.arr).toStrictEqual([30, 40, 50])
  expect(p.modelId).toBe("P3-id")
})
