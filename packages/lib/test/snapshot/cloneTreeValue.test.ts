import { cloneTreeValue, getSnapshot } from "../../src"
import { createP } from "../testbed"

test.each(["node", "snapshot"] as const)(
  "cloneTreeValue keeps default ID regeneration for %s inputs with an undefined option",
  (kind) => {
    const original = createP()
    const input = kind === "node" ? original : getSnapshot(original)
    const copied = cloneTreeValue(input, { generateNewIds: undefined })
    expect(copied.$modelId).not.toBe(original.$modelId)
    expect(copied.p2!.$modelId).not.toBe(original.p2!.$modelId)
  }
)
