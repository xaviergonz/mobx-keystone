import { fromSnapshot, getSnapshot, model, Model, newModel } from "../../src"
import "../commonSetup"

@model("P")
class P extends Model<{ x: number; y: number; z: number }> {
  defaultData = {
    x: 15,
    y: 10,
    z: 30,
  }

  getDefaultData() {
    return this.defaultData
  }

  pMethod() {
    return "p"
  }

  sharedMethod() {
    return "p"
  }
}

@model("P2")
class P2 extends P {
  defaultData = {
    ...super.getDefaultData(),
    y: 20,
  }

  p2Method() {
    return "p2"
  }

  sharedMethod() {
    return super.sharedMethod() + "2"
  }
}

test("subclassing works", () => {
  const p2 = newModel(P2, {})

  expect(p2.data.x).toBe(15)
  expect(p2.data.y).toBe(20)
  expect(p2.data.z).toBe(30)

  expect(p2.pMethod()).toBe("p")
  expect(p2.p2Method()).toBe("p2")
  expect(p2.sharedMethod()).toBe("p2")

  const p2sn = getSnapshot(p2)
  expect(p2sn).toMatchInlineSnapshot(`
    Object {
      "$$metadata": Object {
        "id": "mockedUuid-1",
        "type": "P2",
      },
      "x": 15,
      "y": 20,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot<P2>(p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)
})
