import { applySnapshot, Model, prop } from "../../src"
import { testModel } from "../utils"

test.each(["toString", "valueOf", "constructor", "__proto__"])(
  "model snapshot reconciliation restores the default for omitted %s",
  (key) => {
    @testModel("PrototypeNameDefaults")
    class Item extends Model({ [key]: prop(1) }) {}
    const node = new Item({ [key]: 3 })
    expect(node.$[key]).toBe(3)

    applySnapshot(node, {})
    expect(node.$[key]).toBe(1)

    applySnapshot(node, { [key]: 4 })
    expect(node.$[key]).toBe(4)
  }
)
