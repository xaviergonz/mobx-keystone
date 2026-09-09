import type { IObservableArray } from "mobx"
import { getSnapshot, onPatches, runUnprotected, toTreeNode } from "../../src"

test.each([0, 100_000, 200_000, 210_000])(
  "large array splices preserve snapshots when removing %s items",
  (removedCount) => {
    const initial = Array.from({ length: 210_002 }, (_, i) => i)
    const array = toTreeNode(initial.slice()) as IObservableArray<number>
    const added = Array.from({ length: 200_000 }, () => -1)
    runUnprotected(() => array.spliceWithArray(1, removedCount, added))
    expect(getSnapshot(array)).toEqual([initial[0], ...added, ...initial.slice(1 + removedCount)])
  }
)

test("large equal-length splices emit forward and inverse patches without argument spreading", () => {
  const length = 200_000
  const array = toTreeNode(Array.from({ length }, () => 1)) as IObservableArray<number>
  let forwardCount = 0
  let inverseCount = 0
  const stop = onPatches(array, (patches, inversePatches) => {
    forwardCount += patches.length
    inverseCount += inversePatches.length
    expect(patches[0]).toEqual({ op: "remove", path: [0] })
    expect(patches[length]).toEqual({ op: "add", path: [0], value: 2 })
    expect(patches.at(-1)).toEqual({ op: "add", path: [length - 1], value: 2 })
    expect(inversePatches[0]).toEqual({ op: "add", path: [length - 1], value: 1 })
    expect(inversePatches.at(-1)).toEqual({ op: "remove", path: [0] })
  })
  try {
    runUnprotected(() =>
      array.spliceWithArray(
        0,
        length,
        Array.from({ length }, () => 2)
      )
    )
    expect(forwardCount).toBe(length * 2)
    expect(inverseCount).toBe(length * 2)
    expect(getSnapshot(array)).toEqual(Array.from({ length }, () => 2))
  } finally {
    stop()
  }
})
