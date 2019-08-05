import { fromSnapshot, getSnapshot, model, Model, newModel, prop } from "../../src"
import "../commonSetup"

@model("P")
class P extends Model({
  x: prop(() => 15),
  y: prop(() => 10),
  z: prop(() => 30),
}) {
  pMethod() {
    return "p"
  }

  sharedMethod() {
    return "p"
  }
}

@model("P2")
class P2 extends P {
  p2Method() {
    return "p2"
  }

  sharedMethod() {
    return super.sharedMethod() + "2"
  }
}

test("subclassing works", () => {
  const p2 = newModel(P2, {})

  expect(p2.x).toBe(15)
  expect(p2.y).toBe(10)
  expect(p2.z).toBe(30)

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
      "y": 10,
      "z": 30,
    }
  `)

  const newP2 = fromSnapshot<P2>(p2sn)
  expect(newP2 instanceof P2).toBe(true)
  expect(newP2).not.toBe(p2)
})
