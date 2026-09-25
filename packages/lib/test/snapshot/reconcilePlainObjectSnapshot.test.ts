import { applySnapshot, fromSnapshot, getSnapshot, Model, model, prop, toTreeNode } from "../../src"
import { getMobxVersion } from "../../src/utils"

// MobX 4 finds inherited members (e.g. `toString`) when looking up observable
// properties, so it cannot add properties named like them
const testNewInheritedKey = test.skipIf(getMobxVersion() === 4)

test.each(["toString", "valueOf", "constructor", "__proto__"])(
  "snapshot reconciliation removes omitted own property %s",
  (key) => {
    const node = fromSnapshot<Record<string, unknown>>({ [key]: 1, keep: 2 })
    applySnapshot(node, { keep: 2 })
    expect(Object.hasOwn(node, key)).toBe(false)
    expect(getSnapshot(node)).toEqual({ keep: 2 })
  }
)

test.each(["toString", "valueOf", "constructor", "__proto__"])(
  "nested snapshot reconciliation removes omitted own property %s",
  (key) => {
    const child = fromSnapshot<Record<string, unknown>>({ [key]: 1, keep: 2 })
    const root = toTreeNode({ child })
    applySnapshot(root, { child: { keep: 2 } })
    expect(root.child).toBe(child)
    expect(Object.hasOwn(child, key)).toBe(false)
    expect(getSnapshot(root)).toEqual({ child: { keep: 2 } })
  }
)

testNewInheritedKey.each(["toString", "constructor", "hasOwnProperty"])(
  "snapshot reconciliation adds an object under inherited member name %s",
  (key) => {
    const node = fromSnapshot<Record<string, unknown>>({ keep: 2 })
    applySnapshot(node, { keep: 2, [key]: { a: 1 } })
    expect(getSnapshot(node)).toEqual({ keep: 2, [key]: { a: 1 } })
  }
)

testNewInheritedKey(
  "model snapshot reconciliation adds an object under an inherited member name",
  () => {
    @model("reconcilePlainObjectSnapshot/M")
    class M extends Model({ x: prop<number>() }) {}

    const m = new M({ x: 1 })
    applySnapshot(m, { ...getSnapshot(m), toString: { a: 1 } } as any)
    expect((getSnapshot(m) as any).toString).toEqual({ a: 1 })
  }
)
