import { observable, runInAction } from "mobx"
import { customRef, toTreeNode } from "../../src"

test("reference callbacks receive the previous resolved target", () => {
  const first = toTreeNode({ id: "first" })
  const second = toTreeNode({ id: "second" })
  const selected = observable.box(first, { deep: false })
  const changed = vi.fn()
  const makeRef = customRef<{ id: string }>("PreviousResolvedTarget", {
    resolve: () => selected.get(),
    getId: (target) => (target as { id: string }).id,
    onResolvedValueChange: changed,
  })
  const ref = makeRef(first)
  runInAction(() => selected.set(second))
  expect(changed.mock.calls[0][0] === ref).toBe(true)
  expect(changed.mock.calls[0][1] === second).toBe(true)
  expect(changed.mock.calls[0][2] === first).toBe(true)
  runInAction(() => selected.set(first))
  expect(changed.mock.calls[1][0] === ref).toBe(true)
  expect(changed.mock.calls[1][1] === first).toBe(true)
  expect(changed.mock.calls[1][2] === second).toBe(true)
})
