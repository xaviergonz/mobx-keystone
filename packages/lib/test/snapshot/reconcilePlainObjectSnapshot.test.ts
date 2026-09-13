import { applySnapshot, fromSnapshot, getSnapshot, toTreeNode } from "../../src"

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
