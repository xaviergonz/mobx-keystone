import { onSnapshot, runUnprotected, toTreeNode } from "../../src"

test.each(["node", "getter"] as const)(
  "onSnapshot reports the previous tracked snapshot when registered within an action (%s)",
  (kind) => {
    const root = toTreeNode({ value: 0 })
    const changes: [number, number][] = []
    let dispose!: () => void
    runUnprotected(() => {
      dispose = onSnapshot(kind === "node" ? root : () => root, (snapshot, previous) => {
        changes.push([snapshot.value, previous.value])
      })
      root.value = 1
    })
    try {
      expect(changes).toEqual([])
      runUnprotected(() => {
        root.value = 2
      })
      expect(changes).toEqual([[2, 1]])
      runUnprotected(() => {
        root.value = 3
      })
      expect(changes).toEqual([
        [2, 1],
        [3, 2],
      ])
    } finally {
      dispose()
    }
  }
)
