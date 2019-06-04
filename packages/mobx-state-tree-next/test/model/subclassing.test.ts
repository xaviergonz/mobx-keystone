import { fromSnapshot, getSnapshot, model, Model } from "../../src"
import "../commonSetup"

@model("P")
class P extends Model {
  data = {
    x: 15,
    y: 10,
    z: 30,
  }

  getData() {
    return this.data
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
  data = {
    ...super.getData(),
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
  const p2 = new P2()

  expect(p2.data.x).toBe(15)
  expect(p2.data.y).toBe(20)
  expect(p2.data.z).toBe(30)

  expect(p2.pMethod()).toBe("p")
  expect(p2.p2Method()).toBe("p2")
  expect(p2.sharedMethod()).toBe("p2")

  const p2sn = getSnapshot(p2)
  expect(p2sn).toMatchInlineSnapshot(`
    Object {
      "$$id": "mockedUuid-1",
      "$$typeof": "P2",
      "x": 15,
      "y": 20,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot(p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)
})
